//! GitHub OAuth authorization-code flow with PKCE and a loopback callback.
//! The client secret is read from the process environment and is never sent to
//! the webview or included in an error message.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri_plugin_opener::OpenerExt;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::timeout,
};

fn callback(request: &str, expected_state: &str) -> Option<Result<String, String>> {
    let line = request.lines().next()?;
    let mut parts = line.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let target = parts.next()?;
    if !target.starts_with("/callback?") {
        return None;
    }
    let url = reqwest::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    let mut state = Vec::new();
    let mut code = Vec::new();
    let mut denied = false;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "state" => state.push(value.into_owned()),
            "code" => code.push(value.into_owned()),
            "error" => denied = true,
            _ => {}
        }
    }
    if state.len() != 1 || state[0] != expected_state {
        return None;
    }
    if denied {
        return Some(Err("GitHub authorization was denied".into()));
    }
    if code.len() != 1 || code[0].is_empty() {
        return Some(Err("GitHub did not return an authorization code".into()));
    }
    Some(Ok(code.remove(0)))
}

pub async fn authorize(app: tauri::AppHandle) -> Result<String, String> {
    let client_id = std::env::var("LEPTON_GITHUB_OAUTH_CLIENT_ID").map_err(|_| "GitHub OAuth is not configured: set LEPTON_GITHUB_OAUTH_CLIENT_ID and LEPTON_GITHUB_OAUTH_CLIENT_SECRET")?;
    let secret = std::env::var("LEPTON_GITHUB_OAUTH_CLIENT_SECRET").map_err(|_| "GitHub OAuth is not configured: set LEPTON_GITHUB_OAUTH_CLIENT_ID and LEPTON_GITHUB_OAUTH_CLIENT_SECRET")?;
    if client_id.trim().is_empty() || secret.trim().is_empty() {
        return Err("GitHub OAuth client configuration is empty".into());
    }
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| "Unable to start the local OAuth callback")?;
    let port = listener
        .local_addr()
        .map_err(|_| "Unable to read the local OAuth callback address")?
        .port();
    let redirect = format!("http://127.0.0.1:{port}/callback");
    let state = uuid::Uuid::new_v4().simple().to_string();
    let verifier = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut auth = reqwest::Url::parse("https://github.com/login/oauth/authorize")
        .map_err(|_| "Invalid OAuth endpoint")?;
    auth.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect)
        .append_pair("scope", "gist")
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    app.opener()
        .open_url(auth.as_str(), None::<&str>)
        .map_err(|_| "Unable to open the browser for GitHub sign-in")?;
    let code = timeout(Duration::from_secs(180), async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|_| "OAuth callback listener failed".to_owned())?;
            let mut bytes = [0u8; 8192];
            let read = match timeout(Duration::from_secs(5), async {
                let mut used = 0;
                while used < bytes.len() {
                    let count = stream.read(&mut bytes[used..]).await?;
                    if count == 0 { break; }
                    used += count;
                    if bytes[..used].windows(2).any(|pair| pair == b"\r\n") { break; }
                }
                Ok::<usize, std::io::Error>(used)
            }).await {
                Ok(Ok(n)) if n > 0 => n,
                _ => continue,
            };
            let result = std::str::from_utf8(&bytes[..read]).ok().and_then(|r| callback(r, &state));
            let response = if result.is_some() { "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\nAuthorization received. You may return to Lepton." } else { "HTTP/1.1 400 Bad Request\r\nCache-Control: no-store\r\nConnection: close\r\n\r\nInvalid OAuth callback." };
            let _ = stream.write_all(response.as_bytes()).await;
            if let Some(result) = result { return result; }
        }
    }).await.map_err(|_| "GitHub sign-in timed out")??;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("lepton-snippet-app")
        .build()
        .map_err(|e| e.without_url().to_string())?;
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", &client_id),
            ("client_secret", &secret),
            ("code", &code),
            ("redirect_uri", &redirect),
            ("code_verifier", &verifier),
        ])
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "GitHub OAuth exchange failed (HTTP {})",
            response.status().as_u16()
        ));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| e.without_url().to_string())?;
    body.get("access_token")
        .and_then(serde_json::Value::as_str)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| "GitHub did not issue an access token".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn checks_callback_path_state_and_duplicates() {
        assert_eq!(
            callback(
                "GET /callback?code=ok&state=expected HTTP/1.1\r\n",
                "expected"
            ),
            Some(Ok("ok".into()))
        );
        assert!(callback("GET /callback?code=ok&state=wrong HTTP/1.1\r\n", "expected").is_none());
        assert!(callback("GET /other?code=ok&state=expected HTTP/1.1\r\n", "expected").is_none());
        assert!(callback(
            "GET /callback?code=ok&state=expected&state=expected HTTP/1.1\r\n",
            "expected"
        )
        .is_none());
        assert!(callback(
            "GET /callback?error=access_denied&state=expected HTTP/1.1\r\n",
            "expected"
        )
        .unwrap()
        .is_err());
    }
}
