# tk for OMP

English | [中文](./README.zh.md)

The OMP component of tk, a persistent task runtime. The runtime keeps Task progress, shared understanding, and supporting materials in ordinary project files, and it is installed separately at the fixed user-level path `$HOME/.local/bin/tk`. This Package does not contain the runtime executable.

## Contents

`tk install --harness omp` selects one mode and one language:

- `tools` carries the native OMP adapter and the selected Skill;
- `cli` carries only the selected CLI Skill and this Package manifest, with no native tool registration.

Both modes expose the same six logical operations: search, read, create, update, log, and exec. The first five return a uniform JSON result; exec keeps its raw stdout and stderr contract.

## Compatibility

`18.2.8` is the minimum maintained OMP version, and this section is the authoritative entry for that number. It is a maintenance commitment, not an installation or runtime requirement. There is no upper maintenance bound, and no version number blocks use: no install, loading, registration, or diagnostic path compares the host version against this minimum.

The commitment covers only the host-side code shipped in `tools` mode. The `cli` mode component contains none of that code and carries no OMP-version maintenance commitment. A host below the minimum carries no maintenance commitment, and this declaration does not claim that any version at or above the minimum was verified.

The host version is separate from the runtime contract. Three version markers are claimed or checked in different places:

- the component entry declares the runtime compatibility range `>=0.1,<0.2` in the embedded manifest, and the runtime evaluates that range against its own version when it validates, installs, or removes the component;
- the bundle of components embedded in the runtime declares driver contract version `1`, and the runtime requires that bundle to match the driver contract it implements;
- the generated native tool contract declares `contract_version 3`, and the adapter requires that value together with the fixed compatibility range `>=0.1,<0.2`.

The adapter reads the runtime version document and the native tool contract through the fixed runtime executable and compares their runtime versions for equality. It reads no driver contract version, and it does not compute whether the runtime version falls inside the range.

The Package declares `@oh-my-pi/pi-coding-agent` as an unrestricted peer (`*`). It names the host package the adapter imports. It is not a maintenance range, and it does not establish that any host version can load or run the component.

## Loading and failure behavior

In `tools` mode the entry point completes these preflight checks before registering the first operation:

1. the fixed runtime path exists;
2. the path is a regular file with an executable bit;
3. the runtime version document parses and carries a runtime version;
4. the native tool contract parses, carries contract version `3`, the host's harness name, and the fixed compatibility range;
5. the contract runtime version equals the version document's;
6. all six operations, their request schemas, and the OMP-specific fields are present.

If a check fails, the entry point reports one bounded diagnostic and loads with zero operations registered. It does not terminate the OMP session and does not fall back to another runtime.

If a registration call fails partway through, the adapter stops registering the remaining operations and reports the error. Operations OMP accepted before the failure may stay registered. The adapter provides no rollback guarantee.

## Host differences

The native entry point (`extension.ts`, `tools` mode only) registers the operations with the host and binds the call context: it reads the working directory and the model identity from the OMP call context, and it forwards the OMP cancellation signal to the runtime. Through the host's public loading metadata it marks search, read, create, update, and log as essential and exec as discoverable.

The shared mapping layer (`common.ts`, `tools` mode only) performs the preflight checks, maps a logical request to runtime arguments, starts the executable directly without a shell, bounds stdout and stderr, and decodes the uniform JSON result. The Pi component is a separate Package with its own entry point, and it does not set a loading mode.

## Validation status

The adapter's automated tests run against a stub host and a stub runtime. They cover preflight, argument mapping, cancellation, output limits, zero registration when preflight fails, and the partial-registration behavior described above. They do not show how a real OMP version loads or runs the component. The component assembly tests prove that the shipped files match the component sources and the runtime version; they are not host behavior evidence.

Real OMP validation ran on OMP `18.2.8` with the tk runtime built from these same sources, in an isolated home directory and project. For each of the four mode and language selections it covered installation, loading, and uninstallation. In `tools` mode the host listed all six operations as registered tools, rejected a wrongly typed argument against the declared schema before the call, and executed real search, read, create, update, log, and exec calls against a Task in the project. Only OMP `18.2.8` was observed; no other version was tested.

Earlier tk releases shipped this component in different versions. Their installation records describe those versions, not this one.

## Installation and update

Install and remove the component with the runtime that carries it:

```sh
tk install --harness omp --mode tools --language en
tk uninstall --harness omp
```

`tk install` reads only the payloads embedded in the executable that runs it. Pulling newer repository content replaces neither the installed executable nor its embedded payloads, so an updated repository does not update an installed component.
