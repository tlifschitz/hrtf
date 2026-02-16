class PassthroughProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (input && output) {
      for (let ch = 0; ch < input.length; ch++) {
        output[ch].set(input[ch]);
      }
    }
    return true;
  }
}

registerProcessor('passthrough-processor', PassthroughProcessor);
