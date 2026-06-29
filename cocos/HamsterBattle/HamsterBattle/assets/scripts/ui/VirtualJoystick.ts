import { _decorator, BlockInputEvents, Color, Component, EventMouse, EventTouch, Graphics, Node, UITransform, Vec2, Vec3 } from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';
import { GAME_LAYER } from '../core/LayerUtil';

const { ccclass } = _decorator;

@ccclass('VirtualJoystick')
export class VirtualJoystick extends Component {
    readonly dx = new Vec2(0, 0);
    active = false;

    private _baseX = 0;
    private _baseY = 0;
    private _maxR = 50;
    private _knobR = 20;
    private _knobNode: Node | null = null;
    private _touchId = -1;
    private _localPos = new Vec3();
    private _mouseDown = false;

    onLoad(): void {
        this.node.layer = GAME_LAYER;
        this._baseY = -DESIGN_HEIGHT / 2 + 140;
        this.setupVisuals();
        this.setupTouchZone();
    }

    getDirection(out: Vec2): Vec2 {
        const mag = Math.hypot(this.dx.x, this.dx.y);
        if (mag > 5) {
            out.set(this.dx.x / mag, -this.dx.y / mag);
        } else {
            out.set(0, 0);
        }
        return out;
    }

    isInputBlocked(blocked: boolean): void {
        if (blocked && this.active) {
            this.reset();
        }
    }

    private setupVisuals(): void {
        const base = new Node('JoyBase');
        base.layer = GAME_LAYER;
        this.node.addChild(base);
        base.setPosition(this._baseX, this._baseY, 0);
        base.addComponent(UITransform).setContentSize(96, 96);
        const baseGfx = base.addComponent(Graphics);
        baseGfx.fillColor = new Color(255, 255, 255, 40);
        baseGfx.circle(0, 0, 48);
        baseGfx.fill();
        baseGfx.strokeColor = new Color(255, 255, 255, 80);
        baseGfx.lineWidth = 2;
        baseGfx.circle(0, 0, 48);
        baseGfx.stroke();

        this._knobNode = new Node('JoyKnob');
        this._knobNode.layer = GAME_LAYER;
        this.node.addChild(this._knobNode);
        this._knobNode.setPosition(this._baseX, this._baseY, 0);
        this._knobNode.addComponent(UITransform).setContentSize(40, 40);
        this.drawKnob(0, 0);
    }

    private setupTouchZone(): void {
        const zone = new Node('JoyTouchZone');
        zone.layer = GAME_LAYER;
        this.node.addChild(zone);
        zone.setPosition(0, -DESIGN_HEIGHT * 0.175, 0);
        const ui = zone.addComponent(UITransform);
        ui.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT * 0.35);
        zone.addComponent(BlockInputEvents);
        zone.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        zone.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        zone.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        zone.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        zone.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        zone.on(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        zone.on(Node.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private touchToLocal(event: EventTouch | EventMouse, out: Vec3): void {
        const ui = event.getUILocation();
        this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0), out);
    }

    private applyDrag(event: EventTouch | EventMouse): void {
        this.touchToLocal(event, this._localPos);
        let dx = this._localPos.x - this._baseX;
        let dy = this._localPos.y - this._baseY;
        const d = Math.hypot(dx, dy);
        if (d > this._maxR) {
            dx = (dx / d) * this._maxR;
            dy = (dy / d) * this._maxR;
        }
        this.dx.set(dx, dy);
        this.drawKnob(dx, dy);
    }

    private onTouchStart(event: EventTouch): void {
        this.active = true;
        this._touchId = event.getID();
        this.applyDrag(event);
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.active || event.getID() !== this._touchId) return;
        this.applyDrag(event);
    }

    private onTouchEnd(event: EventTouch): void {
        if (event.getID() !== this._touchId) return;
        this.reset();
    }

    private onMouseDown(event: EventMouse): void {
        this._mouseDown = true;
        this.active = true;
        this.applyDrag(event);
    }

    private onMouseMove(event: EventMouse): void {
        if (!this._mouseDown || !this.active) return;
        this.applyDrag(event);
    }

    private onMouseUp(): void {
        this._mouseDown = false;
        this.reset();
    }

    private reset(): void {
        this.active = false;
        this._touchId = -1;
        this.dx.set(0, 0);
        this.drawKnob(0, 0);
    }

    private drawKnob(offsetX: number, offsetY: number): void {
        if (!this._knobNode) return;
        this._knobNode.setPosition(this._baseX + offsetX, this._baseY + offsetY, 0);
        const g = this._knobNode.getComponent(Graphics) ?? this._knobNode.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(255, 255, 255, 100);
        g.circle(0, 0, this._knobR);
        g.fill();
        g.strokeColor = new Color(255, 255, 255, 160);
        g.lineWidth = 2;
        g.circle(0, 0, this._knobR);
        g.stroke();
    }
}
