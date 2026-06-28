export const SceneNames = {
    Boot: 'Boot',
    Menu: 'Menu',
    Game: 'Game',
} as const;

export type SceneName = typeof SceneNames[keyof typeof SceneNames];
