#!/usr/bin/env bash
set -euo pipefail

bundle_dir="${1:?Expected Tauri bundle directory}"
app="${bundle_dir}/macos/Lepton Rust Prototype.app"
output="${bundle_dir}/dmg/Lepton-Rust-Prototype.dmg"
if [[ ! -d "${app}" ]]; then
  echo 'The macOS app bundle is missing.' >&2
  exit 1
fi

staging="$(mktemp -d "${TMPDIR:-/tmp}/lepton-rust-dmg.XXXXXXXX")"
trap 'rm -rf "${staging}"' EXIT
ditto "${app}" "${staging}/Lepton Rust Prototype.app"
ln -s /Applications "${staging}/Applications"
mkdir -p "${bundle_dir}/dmg"
hdiutil create -volname 'Lepton Rust Prototype' -srcfolder "${staging}" -format UDZO "${output}"
