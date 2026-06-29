import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
} from 'cc';
import { htmlCenterToCocosLocal } from '../core/RoomCoord';
import { roomHasRatHoleVisual, syncGeneratedMapBase } from './RoomBaseBuilder';

const { ccclass, property, executeInEditMode } = _decorator;

interface ZoneDef {
    name: string;
    w: number;
    h: number;
    htmlCx: number;
    htmlCy: number;
    fill: Color;
    stroke: Color;
    label: string;
}

interface RatDef {
    htmlCx: number;
    htmlCy: number;
    r: number;
}

const ROOM_ZONES: Record<number, ZoneDef[]> = {
    1: [{
        name: '01_地板片',
        w: 675,
        h: 975,
        htmlCx: 337.5,
        htmlCy: 487.5,
        fill: new Color(255, 220, 160, 220),
        stroke: new Color(0, 180, 80, 255),
        label: '675 × 975',
    }],
    2: [
        {
            name: '01_地板片_猫区',
            w: 1013,
            h: 488,
            htmlCx: 506.5,
            htmlCy: 244,
            fill: new Color(180, 210, 255, 220),
            stroke: new Color(40, 100, 220, 255),
            label: '1013×488 猫区',
        },
        {
            name: '02_地板片_老鼠区',
            w: 675,
            h: 975,
            htmlCx: 337.5,
            htmlCy: 975.5,
            fill: new Color(255, 220, 160, 220),
            stroke: new Color(200, 100, 40, 255),
            label: '675×975 老鼠区',
        },
        {
            name: '03_地板片_右侧',
            w: 338,
            h: 975,
            htmlCx: 844,
            htmlCy: 975.5,
            fill: new Color(220, 235, 200, 220),
            stroke: new Color(80, 140, 60, 255),
            label: '338×975',
        },
    ],
};

const ROOM_RAT: Record<number, RatDef> = {
    1: { htmlCx: 337.5, htmlCy: 940, r: 24 },
    2: { htmlCx: 337.5, htmlCy: 1428, r: 24 },
};

/** 编辑器 + 运行时绘制房间地板片；鼠洞节点可拖动 */
@ccclass('RoomGuideGizmo')
@executeInEditMode(true)
export class RoomGuideGizmo extends Component {
    @property
    roomId = 1;

    @property
    mapW = 675;

    @property
    mapH = 975;

    /** 勾选后重建 _GeneratedMap 里的 Floor/Walls（会覆盖你对该层的修改） */
    @property
    forceRefreshBase = false;

    onLoad(): void {
        this.rebuild();
    }

    onEnable(): void {
        this.rebuild();
    }

    rebuild(): void {
        const ui = this.getComponent(UITransform) ?? this.addComponent(UITransform);
        ui.setContentSize(this.mapW, this.mapH);
        ui.setAnchorPoint(0.5, 0.5);

        this.clearGuides();
        this.syncBaseLayer();
        this.ensureRatHoleNode();
        this.ensureFurnitureFolder();
    }

    /** 在 Room 下生成 _GeneratedMap/Floor、Walls；保存 Room1Edit 场景后会保留 */
    private syncBaseLayer(): void {
        const def = ROOM_RAT[this.roomId] ?? ROOM_RAT[1];
        syncGeneratedMapBase(this.node, this.mapW, this.mapH, {
            skipRatHole: roomHasRatHoleVisual(this.node),
            ratHole: { x: def.htmlCx, y: def.htmlCy, r: def.r },
            force: this.forceRefreshBase,
        });
        if (this.forceRefreshBase) {
            this.forceRefreshBase = false;
        }
    }

    private clearGuides(): void {
        const remove: Node[] = [];
        for (const child of this.node.children) {
            if (child.name.startsWith('_guide_')) {
                remove.push(child);
            }
        }
        remove.forEach((n) => n.destroy());
    }

    private drawZones(): void {
        const zones = ROOM_ZONES[this.roomId] ?? ROOM_ZONES[1];
        zones.forEach((zone, i) => {
            const pos = htmlCenterToCocosLocal(zone.htmlCx, zone.htmlCy, this.mapW, this.mapH);
            const node = new Node(`_guide_${zone.name}`);
            node.layer = this.node.layer;
            this.node.addChild(node);
            node.setPosition(pos.x, pos.y, 0);
            node.setSiblingIndex(i);

            const zui = node.addComponent(UITransform);
            zui.setContentSize(zone.w, zone.h);
            zui.setAnchorPoint(0.5, 0.5);

            const gfx = node.addComponent(Graphics);
            gfx.fillColor = zone.fill;
            gfx.rect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
            gfx.fill();
            gfx.lineWidth = 6;
            gfx.strokeColor = zone.stroke;
            gfx.rect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
            gfx.stroke();

            const labelNode = new Node('_guide_label');
            labelNode.layer = node.layer;
            node.addChild(labelNode);
            labelNode.setPosition(0, zone.h / 2 - 28, 0);
            labelNode.addComponent(UITransform).setContentSize(zone.w, 40);
            const label = labelNode.addComponent(Label);
            label.string = zone.label;
            label.fontSize = 22;
            label.lineHeight = 26;
            label.color = new Color(40, 40, 40, 255);
            label.useSystemFont = true;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
        });
    }

    private ensureRatHoleNode(): void {
        let hole = this.node.getChildByName('鼠洞_可拖动');
        if (!hole) {
            hole = this.node.getChildByName('鼠洞');
            if (hole) {
                hole.name = '鼠洞_可拖动';
            }
        }
        if (!hole) {
            const def = ROOM_RAT[this.roomId] ?? ROOM_RAT[1];
            const pos = htmlCenterToCocosLocal(def.htmlCx, def.htmlCy, this.mapW, this.mapH);
            hole = new Node('鼠洞_可拖动');
            hole.layer = this.node.layer;
            this.node.addChild(hole);
            hole.setPosition(pos.x, pos.y, 0);
        }
        hole.setSiblingIndex(8000);

        const ring = hole.getChildByName('_guide_鼠洞圈') ?? (() => {
            const n = new Node('_guide_鼠洞圈');
            n.layer = hole.layer;
            hole!.addChild(n);
            return n;
        })();
        const def = ROOM_RAT[this.roomId] ?? ROOM_RAT[1];
        const r = def.r;
        const gfx = ring.getComponent(Graphics) ?? ring.addComponent(Graphics);
        gfx.clear();
        gfx.fillColor = new Color(255, 120, 0, 255);
        gfx.circle(0, 0, r);
        gfx.fill();
        gfx.lineWidth = 4;
        gfx.strokeColor = new Color(255, 255, 0, 255);
        gfx.circle(0, 0, r);
        gfx.stroke();
        gfx.fillColor = new Color(60, 30, 10, 255);
        gfx.circle(0, 0, r * 0.5);
        gfx.fill();

        let tip = hole.getChildByName('_guide_提示');
        if (!tip) {
            tip = new Node('_guide_提示');
            tip.layer = hole.layer;
            hole.addChild(tip);
            tip.setPosition(0, r + 22, 0);
            tip.addComponent(UITransform).setContentSize(160, 30);
            const label = tip.addComponent(Label);
            label.string = '鼠洞(可拖动)';
            label.fontSize = 18;
            label.color = new Color(255, 80, 0, 255);
            label.useSystemFont = true;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
        }
    }

    private ensureFurnitureFolder(): void {
        let folder = this.node.getChildByName('家具_拖图片到这里');
        if (!folder) {
            folder = new Node('家具_拖图片到这里');
            folder.layer = this.node.layer;
            this.node.addChild(folder);
            folder.setSiblingIndex(5000);
        }
        if (!folder.getChildByName('无碰撞')) {
            const noCol = new Node('无碰撞');
            noCol.layer = folder.layer;
            folder.addChild(noCol);

            const tip = new Node('_guide_无碰撞说明');
            tip.layer = folder.layer;
            noCol.addChild(tip);
            tip.setPosition(0, 0, 0);
            tip.addComponent(UITransform).setContentSize(320, 40);
            const label = tip.addComponent(Label);
            label.string = '纯装饰拖到这里(无碰撞)';
            label.fontSize = 16;
            label.color = new Color(120, 120, 120, 255);
            label.useSystemFont = true;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
        }
    }
}
