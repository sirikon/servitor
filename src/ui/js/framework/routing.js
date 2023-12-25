function getInternalUrl() {
    const hash = document.location.hash.replace(/^#/, '');
    return new URL('internal:' + hash);
}
