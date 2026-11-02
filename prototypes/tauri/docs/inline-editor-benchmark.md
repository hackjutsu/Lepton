# Inline editor benchmark

Measured on an Apple Silicon Mac, comparing the inline editor at `da0baa0` with the version that initializes the CodeMirror language before its first render. Each version used an optimized Rust build with the UI-test WebDriver enabled, isolated local fixture data, and a visible window. Runs alternated between versions, three launches each.

| Median | Before | After |
| --- | ---: | ---: |
| Select a small snippet | 34 ms | 34 ms |
| Enter small-file edit mode | 33 ms | 33 ms |
| Display a 512 KiB code file | 700 ms | 250 ms |
| Enter large-file edit mode | 170 ms | 174 ms |
| Insert one character in the large file | 50 ms | 50 ms |
| Memory after viewing the large file | 826 MiB | 766 MiB |
| Memory after editing the large file | 846 MiB | 785 MiB |

The synthetic JavaScript file has 8,192 lines of 64 bytes. View timings cover selection through two animation frames after the editor is ready; the large view was repeated three times per launch. Editing timings use a programmatic CodeMirror insertion, not real keyboard input. They exclude GitHub and network latency.

Memory sums the resident sizes of the app and its WebKit helper processes, after repeated views or edits; shared pages can be counted more than once. The small sample and WebKit memory variation make these directional measurements, not a promise of typical savings. The measurements compare two Rust builds, not Rust against Electron.
