import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** 挂在「无碰撞」文件夹及其子节点上，运行时跳过碰撞生成 */
@ccclass('NoCollisionTag')
export class NoCollisionTag extends Component {}
