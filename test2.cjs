const id = 'yumi';
const lower = id.trim().toLowerCase();
const b = lower === 'global' ||
    lower === 'system' ||
    lower === 'ken-chiko-global-master' ||
    lower === 'ken-chiko-master-meta' ||
    lower === 'ken-chiko-master-nyans' ||
    lower === 'nyanko_stories_meta' ||
    lower.startsWith('ken-chiko-master-') ||
    lower.startsWith('ken-chiko-global-') ||
    lower.startsWith('nyanko_story') ||
    lower.startsWith('nyanko_stories') ||
    lower.startsWith('master-');
console.log(b);
