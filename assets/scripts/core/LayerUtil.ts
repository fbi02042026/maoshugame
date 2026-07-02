import { Layers, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { ACTOR_SCALE } from './DesignConstants';

export const GAME_LAYER = Layers.Enum.UI_2D;

export function setLayerRecursive(node: Node, layer: number = GAME_LAYER): void {
    node.layer = layer;
    for (const child of node.children) {
        setLayerRecursive(child, layer);
    }
}

/** 按素材原始像素尺寸显示，不拉伸、不裁切 */
export function applyNativeSpriteFrame(node: Node, frame: SpriteFrame): Sprite {
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.RAW;
    sprite.trim = false;
    if (frame && frame.texture) {
        sprite.spriteFrame = frame;
    }
    const ui = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    return sprite;
}

/** @deprecated 使用 applyNativeSpriteFrame */
export function applySpriteFrame(node: Node, frame: SpriteFrame, _width: number, _height: number): Sprite {
    return applyNativeSpriteFrame(node, frame);
}

export function getSpritePixelSize(frame: SpriteFrame): { w: number; h: number } {
    return {
        w: frame.originalSize?.width ?? frame.rect.width,
        h: frame.originalSize?.height ?? frame.rect.height,
    };
}

/** 角色/皮肤：原图 RAW 显示后再整体缩小 ACTOR_SCALE */
export function applyActorSpriteFrame(node: Node, frame: SpriteFrame, flipX = false): Sprite {
    applyNativeSpriteFrame(node, frame);
    const sx = (flipX ? -1 : 1) * ACTOR_SCALE;
    node.setScale(sx, ACTOR_SCALE, 1);
    return node.getComponent(Sprite)!;
}
