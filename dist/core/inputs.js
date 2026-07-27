export function parseEntries(entriesInput, _action, options = {}) {
    const separatorMode = options.separatorMode ?? 'newline';
    const entrySpecs = [];
    let current = '';
    for (let index = 0; index < entriesInput.length; index += 1) {
        const character = entriesInput[index];
        if (character === '\n' && separatorMode !== 'single') {
            entrySpecs.push(current);
            current = '';
        }
        else if (character !== '\r') {
            current += character;
        }
    }
    entrySpecs.push(current);
    return entrySpecs
        .filter(entry => entry.trim())
        .map(entry => {
        const colonIndex = entry.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(`Invalid entry format: ${entry}. Expected format: tag:path or tag:restore_path=>save_path`);
        }
        const tag = entry.substring(0, colonIndex).trim();
        const rawPathSpec = entry.substring(colonIndex + 1);
        const pathSpec = rawPathSpec;
        if (!tag) {
            throw new Error(`Invalid entry format: ${entry}. Tag cannot be empty`);
        }
        if (!pathSpec.trim()) {
            throw new Error(`Invalid entry format: ${entry}. Path cannot be empty`);
        }
        let restorePathInput = pathSpec;
        let savePathInput = pathSpec;
        const redirectIndex = pathSpec.indexOf('=>');
        if (redirectIndex !== -1) {
            const rawRestorePath = pathSpec.substring(0, redirectIndex);
            const rawSavePath = pathSpec.substring(redirectIndex + 2);
            restorePathInput = rawRestorePath;
            savePathInput = rawSavePath;
            if (!restorePathInput.trim() || !savePathInput.trim()) {
                throw new Error(`Invalid entry format: ${entry}. Expected restore and save paths when using => syntax`);
            }
        }
        return { tag, restorePath: restorePathInput, savePath: savePathInput };
    });
}
