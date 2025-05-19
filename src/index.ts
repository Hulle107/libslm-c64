import { byte, word } from "@hulle107/libslm-binary";
import { cpu6510 } from "./cpu6510";

const MHz = 0.985;
const memory = {
    read(address: word): byte { return 0; },
    write(address: word, data: byte): void {},
}

const myCPU = new cpu6510(memory, true);
myCPU.debugInfo();

setInterval(() => myCPU.clock(), 1 / MHz / 1000);