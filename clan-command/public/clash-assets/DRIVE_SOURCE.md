# Official artwork — Google Drive source

**Access is strictly read-only.** Nothing in Drive is created, edited,
overwritten, moved or deleted by this project. The only operations ever issued
against Drive are `list`, `get`, `search` and `read`.

## Where the artwork lives

```
100% Afrikaans Clan Family                      1tb38CrYiyyVop8Xdiv06HX9pcplafgdG
└── Arsenaal Assets                             12LhAPW9RKqEzJ8HVusDL4be2p8BbpH3A
```

### Asset folders under `Arsenaal Assets`

| Folder | Drive ID |
| --- | --- |
| Heroes | `1HLdLbKf_atOxWngemk2Ha_AWq1e9MA0Y` |
| Hero Pets | `1XjVKUx_nScrFR4qJy4m1DByKcVCQZey0` |
| Hero Equipment | `1yk6tL-El-eT2jUi4v5pQ704WYl0AQbLJ` |
| Home Village Troops | `1DHauHVST1uzvdr0eQ9TRfEZUj6OXPKZ-` |
| Builder Base Troops | `16neNahaN9HImIGpBSNcDbfdm2foKwOHI` |
| Spells | `1T9JA-9GMm9QAzNkenebic0fnLBQ6OCDx` |
| Siege Machines | `1Z1FghktAF85Fk27xqgrzOZMCXy6Vvgy3` |
| Town Halls | `1On64i0SN9dbzyz5ETN3_Zv5Nsk9OVRcl` |
| Builder Halls | `1Sm2_dL-90QUdz8l5aW_l-CDCwzWGgXCp` |
| Game & UI Icons | `14-ntK13AoPoHNhbklOV5I51X1R50BrYP` |
| Leagues & Ranks | `1xjx5f1ohD_JPu_P7epQ1dzkwIkf2QsLT` |
| Clan, War & Capital | `1JQxiI9nqPBSQHhYokwwTXPepdgVQHlrF` |
| Player & Clan Labels | `1CfCl7psu9wMC9gctgPzl8iGN_MUYmzEP` |
| Flags & Regions | `1hx2RxFPU2tPVHxKAN4NM2JXmD-0hML9w` |
| Skins & Characters | `1UMP-1d_mpY935e7zIEL-AmrlkjgrJSCv` |
| Artwork & Promo | `1dxLiktgmXgYtl1JxGtUNG2ToRU_G1hK6` |
| Supercell UI Vault 2026-09-23 | `11ABl3E9magDxNnLwEZxRU2QyLzvQWY7n` |
| Arsenaal Full Backup 2026-09-20 | `1VRLcrO8RKpM5-Pqpo9ynoerzxBGG8MXh` |
| Official Supercell Announcements PNG | `1eLXJvfO_xvDyXe4i3vC7EfQ66cvZ4wKU` |
| Official Supercell Blog PNG | `1YdQqAS1eDkkhcAIEm4LCFEDNwGg2L9Ip` |
| Official Supercell Fan Kit PNG | `1fn9taVKskccvdrtJX1E6HNXhRCFEnU_X` |

`ARSENAAL_ASSET_INDEX` (`1jP_cI8i3Th1hvHYlNc6Ngk4nyYP6U_3FhcQFKOfsan4`) is the
intended per-file index. It currently holds a header row only — no entries.

## Audit result (2026-10-12)

Every one of the 20 folders above was listed individually. **All of the
categorised asset folders are empty.** The only loose images in the whole tree
are three promotional renders in `Artwork & Promo`:

| File | Drive ID | Size |
| --- | --- | --- |
| `intelligensie-share-1200x630.png` | `1QuKefpia8b_J3xfvgboOzM9wrSJkpTpT` | 785 KB |
| `intelligensie-builder-branded.png` | `13n2SPF107afvVzxw7ue5T91Wo660QzXB` | 1.70 MB |
| `clash-builder-precision-original.jpg` | `1GZlcQp0Ginnk1MYHIhQufQqqAFcIkQ_2` | 248 KB |

Those are marketing stills, not the per-item icons this tracker needs, so they
are not mapped into `clash-assets/`.

The actual game artwork is inside the multi-part ZIP archives sitting beside the
folders — `Arsenaal Full Backup 2026-09-16 — Part 00…04.zip`, the `Pass 2` set,
`Arsenaal Bulk Backup 2026-09-16 Part 00…05.zip`, `Arsenaal Assets Backup.zip`
and the two `Official Supercell Blog/Announcements PNG` part sets. Each part is
~73 MB; the largest single archive is `Arsenaal Assets Backup.zip` at
57,231,509 bytes.

## What that means for this repo

`EXPECTED.md` still lists all 226 target paths and reports how many are
installed. Zero are installed, and that is accurate — no artwork has been
copied in, and none has been generated.

Resolution order is unchanged and degrades cleanly:

1. local official PNG at `public/clash-assets/<category>/<slug>.png`
2. live Supercell `iconUrl` from the API or a JSON import
3. neutral typographic monogram

**No AI-generated imagery is used, anywhere, ever.**

## Installing the artwork

Extract any of the ZIPs above on your own machine, then drop the PNGs into the
matching category folder using the slug rule in `EXPECTED.md`
(`P.E.K.K.A` → `p-e-k-k-a.png`, `L.A.S.S.I` → `l-a-s-s-i.png`,
`Inferno Tower` → `inferno-tower.png`). Builder Base entries that share a name
with a Home Village entry live under the plain name; the `bb-` prefix exists
only in the catalog key, not in the filename.

Then re-run:

```bash
npm run assets:list
```

which rewrites `EXPECTED.md` with the installed count per folder. Nothing else
in the app needs to change — the resolver picks the files up immediately.
