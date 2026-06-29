import { Node } from 'cc';
import { FurnitureMarker } from './FurnitureMarker';
import { NoCollisionTag } from './NoCollisionTag';

const NO_COLLISION_NAME = /noCollision|无碰撞|无碰撞层|不碰撞|nocollision|no_collision/i;

/** 节点是否在无碰撞分支下 */
export function isNoCollisionBranch(node: Node): boolean {
    let cur: Node | null = node;
    while (cur) {
        if (cur.getComponent(NoCollisionTag)) {
            return true;
        }
        if (NO_COLLISION_NAME.test(cur.name.trim())) {
            return true;
        }
        cur = cur.parent;
    }
    return false;
}

function stripFurnitureMarkersInSubtree(root: Node): void {
    const fm = root.getComponent(FurnitureMarker);
    if (fm) {
        fm.destroy();
    }
    for (const child of root.children) {
        stripFurnitureMarkersInSubtree(child);
    }
}

/** 给「无碰撞」文件夹及其全部子节点打标，并移除误挂的 FurnitureMarker */
export function setupNoCollisionBranches(roomNode: Node): void {
    const stack: Node[] = [roomNode];
    while (stack.length > 0) {
        const node = stack.pop()!;
        if (NO_COLLISION_NAME.test(node.name.trim())) {
            tagNoCollisionSubtree(node);
            stripFurnitureMarkersInSubtree(node);
        }
        for (const child of node.children) {
            stack.push(child);
        }
    }
}

export function tagNoCollisionSubtree(root: Node): void {
    if (!root.getComponent(NoCollisionTag)) {
        root.addComponent(NoCollisionTag);
    }
    for (const child of root.children) {
        tagNoCollisionSubtree(child);
    }
}

/** 移除无碰撞层及其子节点上误挂的 FurnitureMarker */
export function stripNoCollisionFurnitureMarkers(roomNode: Node): void {
    setupNoCollisionBranches(roomNode);
}

export function collectFurnitureMarkers(roomNode: Node): FurnitureMarker[] {
    return roomNode
        .getComponentsInChildren(FurnitureMarker)
        .filter((m) => !isNoCollisionBranch(m.node));
}
