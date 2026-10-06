# Android in cloud sessions

Claude Code cloud sessions can build the native Android app. The session-start
hook (`.claude/hooks/session-start.sh`) runs `.claude/scripts/setup-android.sh`,
which installs the toolchain into `~/android-sdk` and exports `ANDROID_HOME`.

## What gets installed

| Piece                   | Version                | Why                             |
| ----------------------- | ---------------------- | ------------------------------- |
| Platform / build tools  | 36 / 36.0.0            | Expo SDK 57 + React Native 0.86 |
| NDK / CMake             | 27.1.12297006 / 3.22.1 | Native modules                  |
| Emulator + system image | API 36, x86_64         | AVD `tt_api36`                  |

Bump these together with the Expo SDK (check
`node_modules/react-native/gradle/libs.versions.toml`). Set
`ANDROID_SKIP_EMULATOR=1` to skip the emulator and its image (~2 GB).

The first run downloads about 8 GB. To cache it in the environment instead of
repeating it each session, add `bash .claude/scripts/setup-android.sh` to the
environment's Setup script (cloud environment menu, then Edit).

## Build a debug APK

```bash
cd apps/client
npx expo prebuild --platform android --no-install   # generates android/ (gitignored)
cd android
./gradlew assembleDebug -PreactNativeArchitectures=x86_64
# -> app/build/outputs/apk/debug/app-debug.apk
```

`expo prebuild` rewrites the `android` script in `apps/client/package.json`
(to `expo run:android`). Revert that edit; don't commit it.

A cold build takes about 8 minutes on 4 cores. Restricting
`reactNativeArchitectures` to `x86_64` cuts it by roughly 4x versus all ABIs.

## Maven Central returns 429

The cloud egress IP is shared, and Maven Central rate-limits it. Gradle treats
a 429 as a hard failure ("plugin not found", or a failure on an artifact
Central doesn't even host). `.claude/scripts/gradle-mirror.init.gradle`
(installed to `~/.gradle/init.d/`) points every Central repository at Google's
Maven Central mirror and keeps the plugin portal as a fallback. If builds fail
with 429 anyway, check that file is in `~/.gradle/init.d/`.

## Emulator limits

Cloud containers have no `/dev/kvm` and expose no CPU virtualization, so the
emulator can only run in software mode (`-accel off`, single-threaded). The
AVD and system image install fine; running them is the problem. Measured on a
4-core container with the API 36 x86_64 image:

- Boot completes after about 22 minutes ("Boot completed in 1320942 ms").
- Right after boot the guest load average reached about 32, and the `package`
  service disappeared (`Can't find service: package`) because `system_server`
  restarted under load. `adb install` of the debug APK failed after 7.5 minutes
  with a broken pipe.

So the emulator is not usable for installing or running the app here. Use the
cloud environment to build (it verifies the native toolchain, see above), and
run the app on a KVM-capable machine. GitHub-hosted Ubuntu runners have KVM, so
a CI job with `reactivecircus/android-emulator-runner` is the way to get
runtime checks. To skip the unused download, set `ANDROID_SKIP_EMULATOR=1`.

For a machine that does have KVM, the same AVD works:

```bash
emulator -avd tt_api36 -no-window -no-audio -no-metrics -no-snapshot \
  -gpu swiftshader_indirect &
adb wait-for-device
adb install -r apps/client/android/app/build/outputs/apk/debug/app-debug.apk
```
