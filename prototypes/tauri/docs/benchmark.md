# Apple Silicon macOS prototype benchmark

Measured 2026-10-31 on the same Mac with one Lepton window at a time. Both
apps displayed the same six-snippet render fixture, including code, Markdown,
and an image. The Electron app was an unpacked production build. The Rust app
was a release-optimized build with the test-only WebDriver feature enabled;
its fixture represents the local library, so remote controls and profile
images differ from the Electron fixture.

| Measurement | Electron | Rust prototype |
| --- | ---: | ---: |
| Installed app directory, `du -sk` | 255.9 MiB | 11.7 MiB |
| Sum of process RSS, three idle samples | 491.2, 498.2, 492.4 MiB | 353.3, 353.3, 353.0 MiB |

The Rust bundle was about 95% smaller in this build. Mean summed RSS was
about 28% lower for this fixture. Electron's four app processes were included;
the Rust measurement included the main process plus the newly started macOS
WebKit content, GPU, and network processes. WebKit helpers already present
before the Rust launch were excluded. Summed RSS counts shared pages more than
once and is not equivalent to physical footprint. The macOS WebKit runtime is
provided by the operating system and is not included in the Rust app size.
These are short, single-machine samples, not a controlled startup, CPU, or
large-account benchmark, and the migration is not feature-complete.
