```
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                            ║
║        ███████╗██╗   ██╗████████╗███████╗ ██████╗██████╗  █████╗ ███████╗████████╗         ║
║        ██╔════╝╚██╗ ██╔╝╚══██╔══╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝         ║
║        █████╗   ╚████╔╝    ██║   █████╗  ██║     ██████╔╝███████║█████╗     ██║            ║
║        ██╔══╝    ╚██╔╝     ██║   ██╔══╝  ██║     ██╔══██╗██╔══██║██╔══╝     ██║            ║
║        ██║        ██║      ██║   ███████╗╚██████╗██║  ██║██║  ██║██║        ██║            ║
║        ╚═╝        ╚═╝      ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝            ║
║                                                                                            ║
║                          combat-first RTS — the fight is the game                          ║
║                                                                                            ║
╚════════════════════════════════════════════════════════════════════════════════════════════╝
```

**FIST — Fighting In Super Teams.** Physics-driven isometric RTS combat: the
match starts at the fight, not at twenty minutes of build order. This
repository holds the game's source. Alpha, and openly so — things are missing,
things will change.

## The monorepo

| Path | What it is |
|---|---|
| `packages/engine` | Combat resolution and the economy. Pure logic, no I/O. |
| `packages/shared` | Constants, stats, and types both sides agree on. |
| `packages/server` | The authoritative game loop and state. |
| `packages/commentary` | The commentary engine and its lines. |
| `apps/client` | PixiJS renderer, Vite dev server. |

## Running it

```
npm install
npm run dev:server
```

```
cd apps/client
npm install
npm run dev
```

Server and client run separately; the client connects over socket.io.
Compiled `dist/` output and `node_modules` are deliberately not in the
repository — `npm run build` regenerates everything.

---

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║      ███████╗      ██╗  ██╗███████╗██╗   ██╗███████╗       ║
║      ██╔════╝      ██║ ██╔╝██╔════╝╚██╗ ██╔╝██╔════╝       ║
║      █████╗  █████╗█████╔╝ █████╗   ╚████╔╝ ███████╗       ║
║      ██╔══╝  ╚════╝██╔═██╗ ██╔══╝    ╚██╔╝  ╚════██║       ║
║      ██║           ██║  ██╗███████╗   ██║   ███████║       ║
║      ╚═╝           ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝       ║
║                                                            ║
║               ·   C  R  E  A  T  I  V  E   ·               ║
║                                                            ║
║          ────────────────────────────────────────          ║
║                                                            ║
║                      Vincent Gonzalez                      ║
║                         f-keys.com                         ║
║                 ORCID 0009-0005-3640-014X                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

Part of [F-Keys](https://f-keys.com) — independent hardware, software
and internet products. See the [working log](https://f-keys.com/log/)
and [live status](https://f-keys.com/status/).
