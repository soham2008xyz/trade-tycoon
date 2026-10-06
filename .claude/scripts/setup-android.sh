#!/bin/bash
# Installs the Android toolchain for Claude Code cloud sessions: SDK, NDK,
# build tools, emulator + a system image, and an AVD. Idempotent: every step
# is skipped when its output already exists, so re-runs are fast.
#
# Called from .claude/hooks/session-start.sh. It can also be pasted into the
# cloud environment's Setup script (`bash .claude/scripts/setup-android.sh`)
# so the ~8 GB download lands in the cached environment image instead of
# repeating each session.
#
# Versions track what Expo SDK 57 / React Native 0.86 generate (see
# node_modules/react-native/gradle/libs.versions.toml). Bump them together
# when the Expo SDK upgrades.
#
# Opt-out: ANDROID_SKIP_EMULATOR=1 skips the emulator + system image (~2 GB)
# and keeps only what native builds need.
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
CMDLINE_TOOLS_VERSION=13114758
PLATFORM="android-36"
BUILD_TOOLS="36.0.0"
NDK="27.1.12297006"
CMAKE="3.22.1"
SYSTEM_IMAGE="system-images;${PLATFORM};google_apis;x86_64"
AVD_NAME="tt_api36"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

if ! command -v java >/dev/null 2>&1; then
  echo "setup-android: JDK not found; the Android SDK tools need Java 17+." >&2
  exit 1
fi

# 1. Command-line tools (bootstrap for everything else).
if [ ! -x "$SDKMANAGER" ]; then
  echo "setup-android: installing cmdline-tools $CMDLINE_TOOLS_VERSION"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL --retry 4 --retry-delay 2 -o "$tmp/clt.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
  unzip -q "$tmp/clt.zip" -d "$tmp/x"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/x/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

# 2. SDK packages. Skip any whose directory already exists.
packages=()
[ -d "$ANDROID_HOME/platform-tools" ] || packages+=("platform-tools")
[ -d "$ANDROID_HOME/platforms/$PLATFORM" ] || packages+=("platforms;$PLATFORM")
[ -d "$ANDROID_HOME/build-tools/$BUILD_TOOLS" ] || packages+=("build-tools;$BUILD_TOOLS")
[ -d "$ANDROID_HOME/ndk/$NDK" ] || packages+=("ndk;$NDK")
[ -d "$ANDROID_HOME/cmake/$CMAKE" ] || packages+=("cmake;$CMAKE")
if [ "${ANDROID_SKIP_EMULATOR:-}" != "1" ]; then
  [ -d "$ANDROID_HOME/emulator" ] || packages+=("emulator")
  [ -d "$ANDROID_HOME/${SYSTEM_IMAGE//;/\/}" ] || packages+=("$SYSTEM_IMAGE")
fi

if [ "${#packages[@]}" -gt 0 ]; then
  echo "setup-android: installing ${packages[*]}"
  # `yes` exits via SIGPIPE once sdkmanager stops reading; that is expected.
  (yes 2>/dev/null || true) | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --install "${packages[@]}" >/dev/null
fi

# 3. AVD for the emulator. Without KVM (cloud containers have none) it boots
# only in slow software mode; see docs/ANDROID.md.
if [ "${ANDROID_SKIP_EMULATOR:-}" != "1" ] && [ ! -d "$HOME/.android/avd/$AVD_NAME.avd" ]; then
  echo "setup-android: creating AVD $AVD_NAME"
  echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
    -n "$AVD_NAME" -k "$SYSTEM_IMAGE" -d pixel_6 --force >/dev/null
fi

# 4. Gradle init script: prefer Google's Maven Central mirror, because Central
# answers 429 to the shared egress IP and Gradle reports that as "not found".
# Gradle reads init scripts from $GRADLE_USER_HOME/init.d, which differs from
# ~/.gradle when an environment relocates its Gradle caches.
GRADLE_INIT_DIR="${GRADLE_USER_HOME:-$HOME/.gradle}/init.d"
mkdir -p "$GRADLE_INIT_DIR"
cp "$SCRIPT_DIR/gradle-mirror.init.gradle" "$GRADLE_INIT_DIR/maven-mirror.gradle"

# 5. Export env for the rest of the session (Gradle and Expo read ANDROID_HOME).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export ANDROID_HOME=\"$ANDROID_HOME\""
    echo "export ANDROID_SDK_ROOT=\"$ANDROID_HOME\""
    echo "export PATH=\"\$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator\""
  } >> "$CLAUDE_ENV_FILE"
fi

echo "setup-android: ready (ANDROID_HOME=$ANDROID_HOME)"
