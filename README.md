Here goes nothing.

## Migrating from cp2020

The system ID has changed from `cp2020` to `cyberpunk`. Existing worlds created under the old name need a small update to their `world.json` before they can load with the new version.

### Manual method

1. Find your world folder inside the Foundry VTT user data directory:
   - **Windows:** `%localappdata%\FoundryVTT\Data\worlds\<your-world>\`
   - **macOS:** `~/Library/Application Support/FoundryVTT/Data/worlds/<your-world>/`
   - **Linux:** `~/.local/share/FoundryVTT/Data/worlds/<your-world>/`
2. Open `world.json` in a text editor.
3. Replace `"system": "cp2020"` with `"system": "cyberpunk"`.
4. Replace any occurrences of `systems/cp2020/` with `systems/cyberpunk/` (e.g. in the `background` field).
5. Save the file and launch Foundry.

### Script method

If you have Node.js installed, you can use the included migration script instead:

```bash
# Migrate all cp2020 worlds in your Foundry data directory
node systems/cyberpunk/migrate-world.js /path/to/FoundryVTT

# Or target a specific world
node systems/cyberpunk/migrate-world.js /path/to/Data/worlds/my-world

# Preview changes without writing (dry run)
node systems/cyberpunk/migrate-world.js --dry-run /path/to/FoundryVTT
```

The script creates a backup of each `world.json` before making changes.

### After migration

Once the world loads, the system automatically migrates internal data (flags and settings) from the old `cp2020` namespace to `cyberpunk`. No further action is needed.

If you previously had the system installed as `systems/cp2020/`, you can safely delete that folder after installing the new `systems/cyberpunk/` version.

***

_This is unofficial content provided under the Homebrew Content Policy of R. Talsorian Games and is not approved or endorsed by RTG. This content references materials that are the property of R. Talsorian Games and its licensees._
