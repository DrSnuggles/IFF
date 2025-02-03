/*
	Audio context with AudioWorklet by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
*/
import {log} from './log.js'
import {resample} from './resample.js'

export async function initContext(dat) {
	stop(dat)

	try {
		dat.ctx = new AudioContext({sampleRate: dat.sampleRate})
	}
	catch (ex) {
		log('Error on init new AudioContext() with samplerate ' + dat.sampleRate + ': ' + ex)
		log('Retrying without specifying samplerate and using resample() instead.')
		dat.ctx = new AudioContext()
	}
	log('srcRate: '+ dat.sampleRate)
	log('destRate: '+ dat.ctx.sampleRate)
	if (dat.sampleRate !== dat.ctx.sampleRate) {
		// Edge for example cannot handle unusual sample rates
		for (let i = 0; i < dat.channels; i++) {
			dat.ch[i] = resample(dat.ch[i], dat.sampleRate, dat.ctx.sampleRate)
		}
	}

	dat.duration = dat.ch.length > 0 ? (dat.ch[0].length / dat.sampleRate) : 0;
	log('duration in seconds: '+ dat.duration)

	// Worker
	//await dat.ctx.audioWorklet.addModule( new URL('audioWorklet.js', import.meta.url) )
	await dat.ctx.audioWorklet.addModule(URL.createObjectURL( new Blob(['class BufferPlayer extends AudioWorkletProcessor{constructor(){super(),this.port.onmessage=this.handleMessage_.bind(this),this.ch=[],this.frame=0}process(e,r,s){if(0==this.ch.length)return!0;if(-1==this.frame)return!0;for(let e=0;e<r[0][0].length;e++){for(let s=0;s<r[0].length;s++)r[0][s][e]=this.ch[s][this.frame];this.frame++,this.frame>=this.ch[0].length&&(this.frame=-1),this.port.postMessage({frame:this.frame})}return!0}handleMessage_(e){e.data.ch&&(this.ch=e.data.ch),e.data.frame>=0&&(this.frame=e.data.frame)}}registerProcessor("bufferplayer-processor",BufferPlayer)'], {type: "application/javascript"}) ))

	dat.aw = new AudioWorkletNode(dat.ctx, 'bufferplayer-processor', {
		numberOfInputs: 0,
		numberOfOutputs: 1,
		outputChannelCount: [dat.channels]
	})
	dat.aw.connect(dat.ctx.destination)	// connect to output
	dat.aw.port.onmessage = (msg) => {
		//console.log('Message from audioWorklet worker', msg)
		if (msg.data.frame >= 0) {
			dat.currentTime = msg.data.frame / dat.sampleRate
		}
		else if (msg.data.frame == -1) {
			if (dat.loops) {
				dat.looped++
				log('looped: ' + dat.looped + ' of ' + (dat.loops < 0 ? 'infinite (until stop() is called)' : dat.loops))
				if (dat.loops >= 0 && dat.looped >= dat.loops) {
					stop(dat)
					if (dat.cbOnEnd) dat.cbOnEnd(dat)
				}
			}
			else {
				stop(dat)
				if (dat.cbOnEnd) dat.cbOnEnd(dat)
			}
		}
	}
}

export async function play(dat, loops) { // use loops < 0 for infinite looping or until stop() is called
	dat.loops = loops
	dat.looped = 0
	dat.paused = false
	dat.currentTime = 0
	dat.aw.port.postMessage({ch:dat.ch})
}

export function stop(dat) {
	dat.paused = false
	if (dat.ctx && dat.ctx.state !== 'closed') dat.ctx.close()
}

export function pause(dat) {
	if (dat.paused) resume(dat)
	else if (dat.ctx && dat.ctx.state === 'running') {
		dat.paused = true
		dat.ctx.suspend()
	}
}

export function resume(dat) {
	dat.paused = false
	if (dat.ctx && dat.ctx.state === 'suspended') dat.ctx.resume()
}

export function getPosition(dat) {
	return dat.currentTime
}

export function setPosition(dat, pos) {
	if (dat.aw) {
		dat.aw.port.postMessage({frame: Math.round(pos * dat.sampleRate)})
	}
}
