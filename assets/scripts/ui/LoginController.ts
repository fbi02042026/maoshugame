import { _decorator, Component, director, Node, Sprite, Button, Label, UIOpacity, UITransform, tween, Vec3, Color, Graphics, sys } from 'cc';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../core/DesignConstants';
import { SaveSystem } from '../core/SaveSystem';
import { SceneNames } from '../core/SceneNames';

const { ccclass } = _decorator;

/**
 * 登录界面控制器
 * 场景文件: assets/scenes/Login.scene
 * 在Cocos Creator编辑器中打开Login.scene，可以可视化调整所有节点的位置
 * 代码只负责动画逻辑和交互
 */
@ccclass('LoginController')
export class LoginController extends Component {
    private _enteringGame = false;
    private _agreementChecked = false;

    start(): void {
        // 检查是否已看过片头漫画
        if (!SaveSystem.data.hasSeenComic) {
            director.loadScene(SceneNames.Comic);
            return;
        }
        // 加载图片并播放动画
        this.playLoginAnimation();
    }

    /** 播放登录动画序列 */
    private async playLoginAnimation(): Promise<void> {
        const canvas = this.node;

        // 获取所有节点
        const loginGroup = canvas.getChildByName('LoginGroup');
        const loginBg = loginGroup?.getChildByName('LoginBg');
        const loginLogo = loginGroup?.getChildByName('LoginLogo');
        const loginShu = loginGroup?.getChildByName('LoginShu');
        const loginMao = loginGroup?.getChildByName('LoginMao');
        const loginStart = canvas.getChildByName('login_start');
        const footerGroup = canvas.getChildByName('FooterGroup');

        // 初始化：隐藏按钮和底部文字
        if (loginStart) {
            const op = loginStart.getComponent(UIOpacity) || loginStart.addComponent(UIOpacity);
            op.opacity = 0;
        }
        if (footerGroup) {
            const op = footerGroup.getComponent(UIOpacity) || footerGroup.addComponent(UIOpacity);
            op.opacity = 0;
        }

        // 1. login_bg：直接显示
        if (loginBg) {
            loginBg.active = true;
        }

        // 2. login_logo：果冻弹出动画
        if (loginLogo) {
            loginLogo.setScale(new Vec3(0, 0, 1));
            tween(loginLogo)
                .delay(0.3)
                .to(0.35, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' })
                .to(0.12, { scale: new Vec3(0.93, 0.93, 1) })
                .to(0.08, { scale: new Vec3(1.0, 1.0, 1) })
                .start();
        }

        // 3. login_shu：从右侧飞入（0.68s，提前20%）
        if (loginShu) {
            const shuStartX = DESIGN_WIDTH * 0.5 + 220; // 右侧屏幕外
            loginShu.setPosition(shuStartX, 20, 0);
            tween(loginShu)
                .delay(0.68)
                .to(0.5, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
                .call(() => {
                    // ±6px晃动
                    tween(loginShu)
                        .by(0.425, { position: new Vec3(0, 6, 0) }, { easing: 'sineOut' })
                        .call(() => {
                            tween(loginShu)
                                .by(0.85, { position: new Vec3(0, -12, 0) }, { easing: 'sineInOut' })
                                .by(0.85, { position: new Vec3(0, 12, 0) }, { easing: 'sineInOut' })
                                .union().repeatForever().start();
                        })
                        .start();
                })
                .start();
        }

        // 4. login_mao：从右侧飞入（0.98s，鼠后0.3s）
        if (loginMao) {
            const maoStartX = DESIGN_WIDTH * 0.5 + 220;
            loginMao.setPosition(maoStartX, -30, 0);
            tween(loginMao)
                .delay(0.98)
                .to(0.5, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
                .call(() => {
                    // ±5px晃动
                    tween(loginMao)
                        .by(0.4, { position: new Vec3(0, 5, 0) }, { easing: 'sineOut' })
                        .call(() => {
                            tween(loginMao)
                                .by(0.8, { position: new Vec3(0, -10, 0) }, { easing: 'sineInOut' })
                                .by(0.8, { position: new Vec3(0, 10, 0) }, { easing: 'sineInOut' })
                                .union().repeatForever().start();
                        })
                        .start();
                })
                .start();
        }

        // 5. 按钮和底部文字：猫飞入时一起出现
        this.scheduleOnce(() => {
            this.showStartButton(loginStart);
            this.showFooter(footerGroup);
        }, 0.98);
    }

    /** 淡入开始按钮并绑定点击 */
    private showStartButton(btn: Node | null): void {
        if (!btn) return;
        const op = btn.getComponent(UIOpacity) || btn.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op)
            .to(0.4, { opacity: 255 }, { easing: 'quadOut' })
            .start();
        btn.on(Button.EventType.CLICK, this.onEnterGame, this);
    }

    /** 淡入底部文字并绑定交互 */
    private showFooter(footer: Node | null): void {
        if (!footer) return;
        const op = footer.getComponent(UIOpacity) || footer.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op)
            .delay(0.2)
            .to(0.4, { opacity: 255 }, { easing: 'quadOut' })
            .start();

        // 绑定勾选框点击
        const agreementRow = footer.getChildByName('AgreementRow');
        if (agreementRow) {
            const checkbox = agreementRow.getChildByName('Checkbox');
            if (checkbox) {
                this.setupCheckbox(checkbox);
            }
            // 绑定协议链接
            const userAgreement = agreementRow.getChildByName('UserAgreement');
            if (userAgreement) {
                userAgreement.on(Button.EventType.CLICK, () => {
                    console.log('[LoginController] 打开用户协议');
                    // sys.openURL('...');
                }, this);
            }
            const privacy = agreementRow.getChildByName('Privacy');
            if (privacy) {
                privacy.on(Button.EventType.CLICK, () => {
                    console.log('[LoginController] 打开隐私保护指引');
                    // sys.openURL('...');
                }, this);
            }
        }
    }

    /** 设置勾选框交互 */
    private setupCheckbox(checkbox: Node): void {
        // 确保有Button组件
        let btn = checkbox.getComponent(Button);
        if (!btn) btn = checkbox.addComponent(Button);

        // 确保有CheckMark子节点
        let checkMark = checkbox.getChildByName('CheckMark');
        if (!checkMark) {
            checkMark = new Node('CheckMark');
            checkbox.addChild(checkMark);
            checkMark.addComponent(UITransform).setContentSize(22, 22);
            const label = checkMark.addComponent(Label);
            label.string = '✓';
            label.fontSize = 18;
            label.lineHeight = 22;
            label.color = new Color(180, 210, 130, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.useSystemFont = true;
        }
        checkMark.active = false;

        checkbox.on(Button.EventType.CLICK, () => {
            this._agreementChecked = !this._agreementChecked;
            if (checkMark) checkMark.active = this._agreementChecked;
        }, this);
    }

    /** 点击进入游戏 */
    private onEnterGame(): void {
        if (this._enteringGame) return;
        if (!this._agreementChecked) {
            this.showToast('请先勾选用户协议');
            return;
        }
        this._enteringGame = true;
        director.loadScene(SceneNames.Menu);
    }

    /**
     * Toast提示 - 白字黑底，2s后上升淡出消失
     * 以后所有提示都使用这个模式
     */
    private showToast(text: string): void {
        const toast = new Node('Toast');
        this.node.addChild(toast);
        toast.setPosition(0, 0);

        const trans = toast.addComponent(UITransform);
        trans.setContentSize(300, 50);
        trans.priority = 20000;

        // 黑色半透明背景
        const bg = new Node('Bg');
        toast.addChild(bg);
        bg.addComponent(UITransform).setContentSize(trans.contentSize);
        const bgGfx = bg.addComponent(Graphics);
        bgGfx.fillColor = new Color(0, 0, 0, 180);
        bgGfx.roundRect(-150, -25, 300, 50, 12);
        bgGfx.fill();

        // 白色文字
        const labelNode = new Node('Label');
        toast.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(trans.contentSize);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 18;
        label.lineHeight = 22;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.useSystemFont = true;

        // 黑色描边
        const shadow = new Node('Shadow');
        toast.addChild(shadow);
        shadow.setPosition(1, -1, -1);
        shadow.addComponent(UITransform).setContentSize(trans.contentSize);
        const sl = shadow.addComponent(Label);
        sl.string = text;
        sl.fontSize = 18;
        sl.lineHeight = 22;
        sl.color = new Color(0, 0, 0, 200);
        sl.horizontalAlign = Label.HorizontalAlign.CENTER;
        sl.verticalAlign = Label.VerticalAlign.CENTER;
        sl.useSystemFont = true;

        // 动画：淡入 → 2s → 上升淡出
        const op = toast.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op)
            .to(0.3, { opacity: 255 }, { easing: 'quadOut' })
            .delay(2)
            .call(() => {
                tween(toast)
                    .to(0.5, { position: new Vec3(0, 80, 0) }, { easing: 'quadOut' })
                    .start();
                tween(op)
                    .to(0.5, { opacity: 0 }, { easing: 'quadOut' })
                    .call(() => toast.destroy())
                    .start();
            })
            .start();
    }
}