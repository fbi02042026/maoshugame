import { _decorator, Component, input, Input, KeyCode, Vec2 } from 'cc';
import { HAMSTER_RADIUS } from '../core/DesignConstants';

const { ccclass, property } = _decorator;

@ccclass('HamsterController')
export class HamsterController extends Component {
    @property
    radius = HAMSTER_RADIUS;

    speed = 115;
    moving = false;
    inputEnabled = true;

    private _keyX = 0;
    private _keyY = 0;
    private _joyX = 0;
    private _joyY = 0;

    onEnable(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    setJoystickDirection(x: number, y: number): void {
        this._joyX = x;
        this._joyY = y;
    }

    getMoveDirection(out: Vec2): boolean {
        if (!this.inputEnabled) {
            out.set(0, 0);
            this.moving = false;
            return false;
        }

        let mx = this._joyX;
        let my = this._joyY;
        const joyLen = Math.hypot(mx, my);
        if (joyLen <= 0.01) {
            mx = this._keyX;
            my = this._keyY;
            const keyLen = Math.hypot(mx, my);
            if (keyLen > 0.01) {
                mx /= keyLen;
                my /= keyLen;
            }
        }

        const len = Math.hypot(mx, my);
        if (len > 0.01) {
            out.set(mx / len, my / len);
            this.moving = true;
            return true;
        }
        out.set(0, 0);
        this.moving = false;
        return false;
    }

    private onKeyDown(event: Input.EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.ARROW_UP:
                this._keyY = 1;
                break;
            case KeyCode.KEY_S:
            case KeyCode.ARROW_DOWN:
                this._keyY = -1;
                break;
            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                this._keyX = -1;
                break;
            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                this._keyX = 1;
                break;
            default:
                break;
        }
    }

    private onKeyUp(event: Input.EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.ARROW_UP:
                if (this._keyY > 0) this._keyY = 0;
                break;
            case KeyCode.KEY_S:
            case KeyCode.ARROW_DOWN:
                if (this._keyY < 0) this._keyY = 0;
                break;
            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                if (this._keyX < 0) this._keyX = 0;
                break;
            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                if (this._keyX > 0) this._keyX = 0;
                break;
            default:
                break;
        }
    }
}
