# Installing Open Trade (unsigned beta)

Open Trade is Openfund's desktop trading workspace. The current public build is
**0.0.4, an unsigned experimental beta**
([release `open-trade-v0.0.4`](https://github.com/algomanlife/openfund/releases/tag/open-trade-v0.0.4)).
It is not signed or notarized, so your operating system warns before opening it.
Only continue if you downloaded the file from that release page or from the
Openfund Applications page, and the SHA-256 checksum matches.

## 1. Check the file

Compare the file's SHA-256 with the value listed on the release page and on the
Applications page.

| System | Command |
| --- | --- |
| macOS | `shasum -a 256 Open-Trade-0.0.4-internal-unsigned-mac-arm64.dmg` |
| Windows (PowerShell) | `Get-FileHash .\Open-Trade-0.0.4-internal-unsigned-win-x64.exe -Algorithm SHA256` |
| Linux | `sha256sum Open-Trade-0.0.4-internal-unsigned-linux-x86_64.AppImage` |

If the value differs, delete the file and do not open it.

## 2. Install

### macOS (Apple Silicon or Intel)

1. Open the `.dmg` (`mac-arm64` for Apple Silicon, `mac-x64` for Intel) and drag
   **Open Trade** to **Applications**.
2. Gatekeeper blocks unsigned apps on a normal double-click. In **Applications**,
   right-click (or Control-click) **Open Trade** and choose **Open**, then
   confirm **Open** in the dialog. macOS remembers this choice.
3. On recent macOS versions the dialog may only offer **Done**. Then open
   **System Settings → Privacy & Security**, find the message about Open Trade
   and choose **Open Anyway**.

### Windows (x64)

1. Run the `.exe` installer.
2. Microsoft Defender SmartScreen shows "Windows protected your PC". Choose
   **More info**, check that the file name matches, then choose **Run anyway**.

### Linux (x64)

- **AppImage**: make it executable, then run it:

  ```bash
  chmod +x Open-Trade-0.0.4-internal-unsigned-linux-x86_64.AppImage
  ./Open-Trade-0.0.4-internal-unsigned-linux-x86_64.AppImage
  ```

- **Debian / Ubuntu (.deb)**:

  ```bash
  sudo apt install ./Open-Trade-0.0.4-internal-unsigned-linux-amd64.deb
  ```

## 3. What to expect

- Open Trade connects only to the official Openfund servers. Sign-in uses your
  wallet signature; it never asks for your seed phrase or private key.
- Prop accounts are simulated; the Perpetual view of Gains is read-only.
- There are no automatic updates. A notice links to the official GitHub
  Release when a newer version exists.

Release notes: [0.0.4](open-trade-0.0.4.md) · [0.0.3](open-trade-0.0.3.md).
