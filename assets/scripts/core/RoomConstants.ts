/** 房间 1 基准尺寸（第 1–2 关） */
export const ROOM1_MAP_W = 675;
export const ROOM1_MAP_H = 975;

/** 房间 2 比房间 1 大 50% */
export const ROOM2_MAP_W = 1013;
export const ROOM2_MAP_H = 1463;

/** 房间 2 内小房间（老鼠区）与房间 1 同尺寸 */
export const ROOM2_SMALL_W = ROOM1_MAP_W;
export const ROOM2_SMALL_H = ROOM1_MAP_H;

/** 房间 2 大房间（猫区）顶部区域高度 = 总高 - 小房间高 */
export const ROOM2_BIG_TOP_H = ROOM2_MAP_H - ROOM2_SMALL_H;
