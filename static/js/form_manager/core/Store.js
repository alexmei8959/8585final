export class Store {
    constructor(initialState = {}) {
        this.listeners = new Set();
        this.state = this._makeObservable(initialState);
    }

    _makeObservable(obj) {
        const handler = {
            set: (target, property, value) => {
                target[property] = value;
                this.notify('STATE_CHANGED', this.state);
                return true;
            },
            deleteProperty: (target, property) => {
                delete target[property];
                this.notify('STATE_CHANGED', this.state);
                return true;
            }
        };
        // 僅對第一層做 Proxy 已足夠處理 actions 中的 Object.assign
        return new Proxy(obj, handler);
    }

    subscribe(event, callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify(event, data) {
        this.listeners.forEach(callback => callback(data));
    }

    async dispatch(actionName, payload) {
        if (this.actions && this.actions[actionName]) {
            await this.actions[actionName](this.state, payload, this);
            // 執行完 action 後強制通知一次，確保視圖同步
            this.notify('STATE_CHANGED', this.state);
        }
    }

    registerActions(actions) {
        this.actions = actions;
    }
}

export const store = new Store({
    meta: { name: "", description: "" },
    header: {},
    footer: {},
    questions: {},
    order: [],
    ui: { selectedId: null }
});