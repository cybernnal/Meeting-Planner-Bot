const updateQueues = new Map();

function runQueue(id, func) {
    if (!updateQueues.has(id)) {
        updateQueues.set(id, Promise.resolve());
    }
    const queue = updateQueues.get(id)
        .then(() => func())
        .catch(console.error);
    updateQueues.set(id, queue);
    return queue;
}

module.exports = { runQueue };
