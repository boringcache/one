export function requireCliVerificationTags(tags, adapter) {
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
        throw new Error(`The selected BoringCache CLI did not return exact verification tags for ${adapter}. `
            + 'Use a CLI release that supports the current boringcache/one plan contract.');
    }
    return Array.from(new Set(tags));
}
export function resolveVerificationTags(specs) {
    return Array.from(new Set(specs.map((spec) => spec.tag)));
}
export function buildGenericVerificationSpecs(plan, saveExpected = false) {
    return plan.archiveVerificationTags.map((tag) => ({ tag, saveExpected }));
}
