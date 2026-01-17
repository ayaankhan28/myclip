const EventEmitter = require('events');

class StateManager extends EventEmitter {
    constructor() {
        super();
        this.state = {
            mode: 'idle', // 'idle', 'host', 'join'
            roomCode: null,
            serverIP: null,
            connectedPeers: 0
        };
    }

    getState() {
        return { ...this.state };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.emit('stateChanged', this.state);
    }

    updateConnectedPeers(count) {
        this.state.connectedPeers = count;
        this.emit('stateChanged', this.state);
    }
}

module.exports = StateManager;
