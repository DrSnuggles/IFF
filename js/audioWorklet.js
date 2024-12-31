//
// AudioWorklet rocessor
//
class BufferPlayer extends AudioWorkletProcessor {
	constructor() {
		super()
		this.port.onmessage = this.handleMessage_.bind(this)
		this.ch = []
		this.frame = 0
	} // constructor

	process(inputList, outputList, parameters) {
		if (this.ch.length == 0) return true	// silence
		if (this.frame == -1) return true	// silence
		
		for (let i = 0; i < outputList[0][0].length; i++) {
			for (let ch = 0; ch < outputList[0].length; ch++) {
				outputList[0][ch][i] = this.ch[ch][this.frame]
			}
			this.frame++
			// detect end
			if (this.frame >= this.ch[0].length) {
				this.frame = -1
			}
			this.port.postMessage({frame: this.frame})
		}
		return true
	} // process

	handleMessage_(msg) {
		if (msg.data.ch) this.ch = msg.data.ch
		if (msg.data.frame >= 0) this.frame = msg.data.frame
	} // handleMessage_
}
registerProcessor('bufferplayer-processor', BufferPlayer)