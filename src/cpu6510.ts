//#################################################################################
//#     Title:  CPU 6510
//#     Author: Delta Thiesen <delta.thiesen.1990@gmail.com>
//#################################################################################
//#     Sources:
//#         - https://en.wikipedia.org/wiki/MOS_Technology_6502
//#         - https://www.princeton.edu/~mae412/HANDOUTS/Datasheets/6502.pdf
//#         - https://www.masswerk.at/6502/6502_instruction_set.html
//#         - http://www.unusedino.de/ec64/technical/aay/c64/index.htm
//#         - https://codebase64.org/lib/exe/fetch.php?media=base:nomoresecrets-nmos6510unintendedopcodes-20202412.pdf
//#         - https://www.masswerk.at/6502/
//#################################################################################

//#################################################################################
//#
//#     IMPORTS
//#
//#################################################################################

import { bit, byte, word } from "@hulle107/libslm-binary";
import { foregroundColor, ForegroundColor, format, Formatting } from "./output";

//#################################################################################
//#
//#     TYPES
//#
//#################################################################################

export type OperationFunction = () => void;
export type AddressingFunction = () => void;
export type SequenceFunction = OperationFunction | AddressingFunction;

//#################################################################################
//#
//#     INTERFACES
//#
//#################################################################################

export interface MemoryLike {
    read: (address: word) => byte;
    write: (address: word, data: byte) => void;
}

//#################################################################################
//#
//#     CONSTANTS
//#
//#################################################################################

const CLASSNAME_DEFAULT = 'CPU6510';
const PROGRAM_COUNTER_DEFUALT = word(0xFFFC);
const STATUS_REGISTER_DEFUALT = byte(0b00000100);
const STACK_POINTER_DEFUALT = byte(0);
const ACCUMULATOR_DEFUALT = byte(0);
const X_REGISTER_DEFUALT = byte(0);
const Y_REGISTER_DEFUALT = byte(0);
const INSTRUCTION_REGISTER_DEFUALT = byte(0);
const INTERNAL_ADDRESS_DATA_DEFUALT = word(0);

const ADDRESS_BUS_BUFFER_DEFUALT = word(0);
const DATA_BUS_BUFFER_DEFUALT = byte(0);

export class cpu6510 {
    //#################################################################################
    //#
    //#     CONTRUCTORS
    //#
    //#################################################################################

    constructor(memory: MemoryLike, debug: boolean = false) {
        this.debug = debug;
        this.memory = memory;
        this.logCall('Constructor');
        this.defaultState();
        this.log('Done');
    }

    //#################################################################################
    //#
    //#     PRIVATE VARIABLES
    //#
    //#################################################################################

    //---------------------------------------------------------------------------------
    //      Registers
    //---------------------------------------------------------------------------------

    private PCL: byte = 0;
    private PCH: byte = 0;
    private PS:  byte = 0;
    private SP:  byte = 0;
    private AC:  byte = 0;
    private XR:  byte = 0;
    private YR:  byte = 0;

    //---------------------------------------------------------------------------------
    //      Compination Registers
    //---------------------------------------------------------------------------------

    private get PC() { return word((this.PCH << byte.size) + this.PCL); }
    private set PC(data: number) {
        this.PCL = byte(data);
        this.PCH = byte(data >> byte.size);
    }

    //---------------------------------------------------------------------------------
    //      Internals
    //---------------------------------------------------------------------------------

    private I_I:  byte = 0;
    private I_ADL: byte = 0;
    private I_ADH: byte = 0;
    private I_DB:  byte = 0;

    //---------------------------------------------------------------------------------
    //      Compination Internals
    //---------------------------------------------------------------------------------

    private get I_AD() { return word((this.I_ADH << byte.size) + this.I_ADL); }
    private set I_AD(data: number) {
        this.I_ADL = byte(data);
        this.I_ADH = byte(data >> byte.size);
    }

    //---------------------------------------------------------------------------------
    //      Pins
    //---------------------------------------------------------------------------------

    private IO_DB:  byte = 0;
    private IO_ABL: byte = 0;
    private IO_ABH: byte = 0;

    //---------------------------------------------------------------------------------
    //      Compination Pins
    //---------------------------------------------------------------------------------

    private get IO_AB() { return word((this.IO_ABH << byte.size) + this.IO_ABL); }
    private set IO_AB(data: number) {
        this.IO_ABL = byte(data);
        this.IO_ABH = byte(data >> byte.size);
    }

    //#################################################################################
    //#
    //#     PROTECTED VARIABLES
    //#
    //#################################################################################

    //---------------------------------------------------------------------------------
    //      Functionality
    //---------------------------------------------------------------------------------

    protected sequences: SequenceFunction[] = [];

    //---------------------------------------------------------------------------------
    //      Collections
    //---------------------------------------------------------------------------------

    /**
     * # Operation Table
     * 
     * ## - Collection
     * 
     * Used in this emulation of the processor to have a easy lookup table for operations, where
     * the real processor would have hardwired logic, this emulation needs a way to know what
     * operations to take.
     */
    protected operations: Record<byte, OperationFunction> = {
        0x00: this.BRK, 0x01: this.ORA, 0x02: this.JAM, 0x03: this.SLO, 0x04: this.NOP, 0x05: this.ORA, 0x06: this.ASL, 0x07: this.SLO,
        0x10: this.BPL, 0x11: this.ORA, 0x12: this.JAM, 0x13: this.SLO, 0x14: this.NOP, 0x15: this.ORA, 0x16: this.ASL, 0x17: this.SLO,
        0x20: this.JSR, 0x21: this.AND, 0x22: this.JAM, 0x23: this.RLA, 0x24: this.BIT, 0x25: this.AND, 0x26: this.ROL, 0x27: this.RLA,
        0x30: this.BMI, 0x31: this.AND, 0x32: this.JAM, 0x33: this.RLA, 0x34: this.NOP, 0x35: this.AND, 0x36: this.ROL, 0x37: this.RLA,
        0x40: this.RTI, 0x41: this.EOR, 0x42: this.JAM, 0x43: this.SRE, 0x44: this.NOP, 0x45: this.EOR, 0x46: this.LSR, 0x47: this.SRE,
        0x50: this.BVC, 0x51: this.EOR, 0x52: this.JAM, 0x53: this.SRE, 0x54: this.NOP, 0x55: this.EOR, 0x56: this.LSR, 0x57: this.SRE,
        0x60: this.RTS, 0x61: this.ADC, 0x62: this.JAM, 0x63: this.RRA, 0x64: this.NOP, 0x65: this.ADC, 0x66: this.ROR, 0x67: this.RRA,
        0x70: this.BVS, 0x71: this.ADC, 0x72: this.JAM, 0x73: this.RRA, 0x74: this.NOP, 0x75: this.ADC, 0x76: this.ROR, 0x77: this.RRA,
        0x80: this.NOP, 0x81: this.STA, 0x82: this.NOP, 0x83: this.SAX, 0x84: this.STY, 0x85: this.STA, 0x86: this.STX, 0x87: this.SAX,
        0x90: this.BCC, 0x91: this.STA, 0x92: this.JAM, 0x93: this.SHA, 0x94: this.STY, 0x95: this.STA, 0x96: this.STX, 0x97: this.SAX,
        0xA0: this.LDY, 0xA1: this.LDA, 0xA2: this.LDX, 0xA3: this.LAX, 0xA4: this.LDY, 0xA5: this.LDA, 0xA6: this.LDX, 0xA7: this.LAX,
        0xB0: this.BCS, 0xB1: this.LDA, 0xB2: this.JAM, 0xB3: this.LAX, 0xB4: this.LDY, 0xB5: this.LDA, 0xB6: this.LDX, 0xB7: this.LAX,
        0xC0: this.CPY, 0xC1: this.CMP, 0xC2: this.NOP, 0xC3: this.DCP, 0xC4: this.CPY, 0xC5: this.CMP, 0xC6: this.DEC, 0xC7: this.DCP,
        0xD0: this.BNE, 0xD1: this.CMP, 0xD2: this.JAM, 0xD3: this.DCP, 0xD4: this.NOP, 0xD5: this.CMP, 0xD6: this.DEC, 0xD7: this.DCP,
        0xE0: this.CPX, 0xE1: this.SBC, 0xE2: this.NOP, 0xE3: this.ISB, 0xE4: this.CPX, 0xE5: this.SBC, 0xE6: this.INC, 0xE7: this.ISB,
        0xF0: this.BEQ, 0xF1: this.SBC, 0xF2: this.JAM, 0xF3: this.ISB, 0xF4: this.NOP, 0xF5: this.SBC, 0xF6: this.INC, 0xF7: this.ISB,

        0x08: this.PHP, 0x09: this.ORA, 0x0A: this.ASL, 0x0B: this.ANS, 0x0C: this.NOP, 0x0D: this.ORA, 0x0E: this.ASL, 0x0F: this.SLO,
        0x18: this.CLC, 0x19: this.ORA, 0x1A: this.NOP, 0x1B: this.SLO, 0x1C: this.NOP, 0x1D: this.ORA, 0x1E: this.ASL, 0x1F: this.SLO,
        0x28: this.PLP, 0x29: this.AND, 0x2A: this.ROL, 0x2B: this.ANR, 0x2C: this.BIT, 0x2D: this.AND, 0x2E: this.ROL, 0x2F: this.RLA,
        0x38: this.SEC, 0x39: this.AND, 0x3A: this.NOP, 0x3B: this.RLA, 0x3C: this.NOP, 0x3D: this.AND, 0x3E: this.ROL, 0x3F: this.RLA,
        0x48: this.PHA, 0x49: this.EOR, 0x4A: this.LSR, 0x4B: this.ASR, 0x4C: this.JMP, 0x4D: this.EOR, 0x4E: this.LSR, 0x4F: this.SRE,
        0x58: this.CLI, 0x59: this.EOR, 0x5A: this.NOP, 0x5B: this.SRE, 0x5C: this.NOP, 0x5D: this.EOR, 0x5E: this.LSR, 0x5F: this.SRE,
        0x68: this.PLA, 0x69: this.ADC, 0x6A: this.ROR, 0x6B: this.ARR, 0x6C: this.JMP, 0x6D: this.ADC, 0x6E: this.ROR, 0x6F: this.RRA,
        0x78: this.SEI, 0x79: this.ADC, 0x7A: this.NOP, 0x7B: this.RRA, 0x7C: this.NOP, 0x7D: this.ADC, 0x7E: this.ROR, 0x7F: this.RRA,
        0x88: this.DEY, 0x89: this.NOP, 0x8A: this.TXA, 0x8B: this.ANE, 0x8C: this.STY, 0x8D: this.STA, 0x8E: this.STX, 0x8F: this.SAX,
        0x98: this.TYA, 0x99: this.STA, 0x9A: this.TXS, 0x9B: this.TAS, 0x9C: this.SHY, 0x9D: this.STA, 0x9E: this.SHX, 0x9F: this.SHA,
        0xA8: this.TAY, 0xA9: this.LDA, 0xAA: this.TAX, 0xAB: this.LXA, 0xAC: this.LDY, 0xAD: this.LDA, 0xAE: this.LDX, 0xAF: this.LAX,
        0xB8: this.CLV, 0xB9: this.LDA, 0xBA: this.TSX, 0xBB: this.LEA, 0xBC: this.LDY, 0xBD: this.LDA, 0xBE: this.LDX, 0xBF: this.LAX,
        0xC8: this.INY, 0xC9: this.CMP, 0xCA: this.DEX, 0xCB: this.SBX, 0xCC: this.CPY, 0xCD: this.CMP, 0xCE: this.DEC, 0xCF: this.DCP,
        0xD8: this.CLD, 0xD9: this.CMP, 0xDA: this.NOP, 0xDB: this.DCP, 0xDC: this.NOP, 0xDD: this.CMP, 0xDE: this.DEC, 0xDF: this.DCP,
        0xE8: this.INX, 0xE9: this.SBC, 0xEA: this.NOP, 0xEB: this.USB, 0xEC: this.CPX, 0xED: this.SBC, 0xEE: this.INC, 0xEF: this.ISB,
        0xF8: this.SED, 0xF9: this.SBC, 0xFA: this.NOP, 0xFB: this.ISB, 0xFC: this.NOP, 0xFD: this.SBC, 0xFE: this.INC, 0xFF: this.ISB,
    };

    /**
     * # Addressing Table
     * 
     * ## - Collection
     * 
     * Used in this emulation of the processor to have a easy lookup table for how to perform addressing, 
     * where the real processor would have hardwired logic, this emulation needs a way to know what
     * addressing to take.
     */
    protected addressings: Record<number, AddressingFunction> = {
        0x00: this.IMP, 0x01: this.IDX, 0x02: this.IMM, 0x03: this.IDX, 0x04: this.ZPG, 0x05: this.ZPG, 0x06: this.ZPG, 0x07: this.ZPG,
        0x10: this.REL, 0x11: this.IDY, 0x12: this.IMM, 0x13: this.IDY, 0x14: this.ZPX, 0x15: this.ZPX, 0x16: this.ZPX, 0x17: this.ZPX,
        0x20: this.ABS, 0x21: this.IDX, 0x22: this.IMM, 0x23: this.IDX, 0x24: this.ZPG, 0x25: this.ZPG, 0x26: this.ZPG, 0x27: this.ZPG,
        0x30: this.REL, 0x31: this.IDY, 0x32: this.IMM, 0x33: this.IDY, 0x34: this.ZPX, 0x35: this.ZPX, 0x36: this.ZPX, 0x37: this.ZPX,
        0x40: this.IMP, 0x41: this.IDX, 0x42: this.IMM, 0x43: this.IDX, 0x44: this.ZPG, 0x45: this.ZPG, 0x46: this.ZPG, 0x47: this.ZPG,
        0x50: this.REL, 0x51: this.IDY, 0x52: this.IMM, 0x53: this.IDY, 0x54: this.ZPX, 0x55: this.ZPX, 0x56: this.ZPX, 0x57: this.ZPX,
        0x60: this.IMP, 0x61: this.IDX, 0x62: this.IMM, 0x63: this.IDX, 0x64: this.ZPG, 0x65: this.ZPG, 0x66: this.ZPG, 0x67: this.ZPG,
        0x70: this.REL, 0x71: this.IDY, 0x72: this.IMM, 0x73: this.IDY, 0x74: this.ZPX, 0x75: this.ZPX, 0x76: this.ZPX, 0x77: this.ZPX,
        0x80: this.IMM, 0x81: this.IDX, 0x82: this.IMM, 0x83: this.IDX, 0x84: this.ZPG, 0x85: this.ZPG, 0x86: this.ZPG, 0x87: this.ZPG,
        0x90: this.REL, 0x91: this.IDY, 0x92: this.IMM, 0x93: this.IDY, 0x94: this.ZPX, 0x95: this.ZPX, 0x96: this.ZPY, 0x97: this.ZPY,
        0xA0: this.IMM, 0xA1: this.IDX, 0xA2: this.IMM, 0xA3: this.IDX, 0xA4: this.ZPG, 0xA5: this.ZPG, 0xA6: this.ZPG, 0xA7: this.ZPG,
        0xB0: this.REL, 0xB1: this.IDY, 0xB2: this.IMM, 0xB3: this.IDY, 0xB4: this.ZPX, 0xB5: this.ZPX, 0xB6: this.ZPY, 0xB7: this.ZPY,
        0xC0: this.IMM, 0xC1: this.IDX, 0xC2: this.IMM, 0xC3: this.IDX, 0xC4: this.ZPG, 0xC5: this.ZPG, 0xC6: this.ZPG, 0xC7: this.ZPG,
        0xD0: this.REL, 0xD1: this.IDY, 0xD2: this.IMM, 0xD3: this.IDY, 0xD4: this.ZPX, 0xD5: this.ZPX, 0xD6: this.ZPX, 0xD7: this.ZPX,
        0xE0: this.IMM, 0xE1: this.IDX, 0xE2: this.IMM, 0xE3: this.IDX, 0xE4: this.ZPG, 0xE5: this.ZPG, 0xE6: this.ZPG, 0xE7: this.ZPG,
        0xF0: this.REL, 0xF1: this.IDY, 0xF2: this.IMM, 0xF3: this.IDY, 0xF4: this.ZPX, 0xF5: this.ZPX, 0xF6: this.ZPX, 0xF7: this.ZPX,

        0x08: this.IMP, 0x09: this.IMM, 0x0A: this.ACU, 0x0B: this.IMM, 0x0C: this.ABS, 0x0D: this.ABS, 0x0E: this.ABS, 0x0F: this.ABS,
        0x18: this.IMP, 0x19: this.ABY, 0x1A: this.IMP, 0x1B: this.ABY, 0x1C: this.ABX, 0x1D: this.ABX, 0x1E: this.ABX, 0x1F: this.ABX,
        0x28: this.IMP, 0x29: this.IMM, 0x2A: this.ACU, 0x2B: this.IMM, 0x2C: this.ABS, 0x2D: this.ABS, 0x2E: this.ABS, 0x2F: this.ABS,
        0x38: this.IMP, 0x39: this.ABY, 0x3A: this.IMP, 0x3B: this.ABY, 0x3C: this.ABX, 0x3D: this.ABX, 0x3E: this.ABX, 0x3F: this.ABX,
        0x48: this.IMP, 0x49: this.IMM, 0x4A: this.ACU, 0x4B: this.IMM, 0x4C: this.ABS, 0x4D: this.ABS, 0x4E: this.ABS, 0x4F: this.ABS,
        0x58: this.IMP, 0x59: this.ABY, 0x5A: this.IMP, 0x5B: this.ABY, 0x5C: this.ABX, 0x5D: this.ABX, 0x5E: this.ABX, 0x5F: this.ABX,
        0x68: this.IMP, 0x69: this.IMM, 0x6A: this.ACU, 0x6B: this.IMM, 0x6C: this.ABS, 0x6D: this.ABS, 0x6E: this.ABS, 0x6F: this.ABS,
        0x78: this.IMP, 0x79: this.ABY, 0x7A: this.IMP, 0x7B: this.ABY, 0x7C: this.ABX, 0x7D: this.ABX, 0x7E: this.ABX, 0x7F: this.ABX,
        0x88: this.IMP, 0x89: this.IMM, 0x8A: this.IMP, 0x8B: this.IMM, 0x8C: this.ABS, 0x8D: this.ABS, 0x8E: this.ABS, 0x8F: this.ABS,
        0x98: this.IMP, 0x99: this.ABY, 0x9A: this.IMP, 0x9B: this.ABY, 0x9C: this.ABX, 0x9D: this.ABX, 0x9E: this.ABY, 0x9F: this.ABY,
        0xA8: this.IMP, 0xA9: this.IMM, 0xAA: this.IMP, 0xAB: this.IMM, 0xAC: this.ABS, 0xAD: this.ABS, 0xAE: this.ABS, 0xAF: this.ABS,
        0xB8: this.IMP, 0xB9: this.ABY, 0xBA: this.IMP, 0xBB: this.ABY, 0xBC: this.ABX, 0xBD: this.ABX, 0xBE: this.ABY, 0xBF: this.ABY,
        0xC8: this.IMP, 0xC9: this.IMM, 0xCA: this.IMP, 0xCB: this.IMM, 0xCC: this.ABS, 0xCD: this.ABS, 0xCE: this.ABS, 0xCF: this.ABS,
        0xD8: this.IMP, 0xD9: this.ABY, 0xDA: this.IMP, 0xDB: this.ABY, 0xDC: this.ABX, 0xDD: this.ABX, 0xDE: this.ABX, 0xDF: this.ABX,
        0xE8: this.IMP, 0xE9: this.IMM, 0xEA: this.IMP, 0xEB: this.IMM, 0xEC: this.ABS, 0xED: this.ABS, 0xEE: this.ABS, 0xEF: this.ABS,
        0xF8: this.IMP, 0xF9: this.ABY, 0xFA: this.IMP, 0xFB: this.ABY, 0xFC: this.ABX, 0xFD: this.ABX, 0xFE: this.ABX, 0xFF: this.ABX,
    };

    //---------------------------------------------------------------------------------
    //      Registers
    //---------------------------------------------------------------------------------

    /**
     * # Program Counter
     * 
     * ## - Register
     * 
     * The 16-bit **program counter** provides the addresses which step the microprocessor through sequential instructions in a
     * program.
     * 
     * Each time the microprocessor fetches an instruction from program memory, the lower byte of the **program counter**
     * 'PCL' is placed on the low-order bits of the address bus and the higher byte of the **program counter** 'PCH' is
     * placed on the high-order 8 bits.
     * 
     * The counter is incremented each time an instruction or data is fetched from program memory.
     * 
     * @alias PC
     */
    protected get programCounter(): word { return word(this.PC); }
    protected set programCounter(data: number) { this.PC = word(data); this.logAction('Setting', 'Register', 'Program Counter', word(data)); }

    /**
     * # Program Counter Low
     * 
     * ## - Register
     * 
     * The lower byte of the **program counter** 'PCL' is placed on the low-order bits of the address bus.
     * 
     * @alias PCL
     */
    protected get programCounterLow(): byte { return byte(this.PCL); }
    protected set programCounterLow(data: number) { this.PCL = byte(data); this.logAction('Setting', 'Register', 'Program Counter Low', byte(data)); }

    /**
     * # Program Counter High
     * 
     * ## - Register
     * 
     * The higher byte of the **program counter** 'PCH' is placed on the high-order 8 bits.
     * 
     * @alias PCH
     */
    protected get programCounterHigh(): byte { return byte(this.PCH); }
    protected set programCounterHigh(data: number) { this.PCH = byte(data); this.logAction('Setting', 'Register', 'Program Counter High', byte(data)); }

    /**
     * # Processor Status
     * 
     * ## - Register
     * 
     * @alias PS
     */
    protected get statusRegister(): byte { return byte(this.PS); };
    protected set statusRegister(data: number) { this.PS = byte(data); this.logAction('Setting', 'Register', 'Processor Status', byte(data)); }

    /**
     * # Stack Pointer
     * 
     * ## - Register
     * 
     * @alias SP
     */
    protected get stackPointer(): byte { return byte(this.SP); };
    protected set stackPointer(data: number) { this.SP = byte(data); this.logAction('Setting', 'Register', 'Stack Pointer', byte(data)); }

    /**
     * # Accumulator
     * 
     * ## - Register
     * 
     * @alias AC
     */
    protected get accumulator(): byte { return byte(this.AC); };
    protected set accumulator(data: number) { this.AC = byte(data); this.logAction('Setting', 'Register', 'Accumulator', byte(data)); }

    /**
     * # Index X
     * 
     * ## - Register
     * 
     * @alias XR
     */
    protected get indexX(): byte { return byte(this.XR); };
    protected set indexX(data: number) { this.XR = byte(data); this.logAction('Setting', 'Regsiter', 'Index X', byte(data)); }

    /**
     * # Index Y
     * 
     * ## - Register
     * 
     * @alias YR
     */
    protected get indexY(): byte { return byte(this.YR); };
    protected set indexY(data: number) { this.YR = byte(data); this.logAction('Setting', 'Regsiter', 'Index Y', byte(data)); }

    //---------------------------------------------------------------------------------
    //      Flags
    //---------------------------------------------------------------------------------

    protected get negativeFlag(): bit { return byte.get(this.PS, 7)? 1 : 0; }
    protected set negativeFlag(value: bit) { this.PS = byte.set(this.PS, 7, value); this.logAction('Setting', 'Flag', 'Negative', value); }

    protected get overflowFlag(): bit { return byte.get(this.PS, 6)? 1 : 0; }
    protected set overflowFlag(value: bit) { this.PS = byte.set(this.PS, 6, value); this.logAction('Setting', 'Flag', 'Overflow', value); }

    protected get breakFlag(): bit { return byte.get(this.PS, 4)? 1 : 0; }
    protected set breakFlag(value: bit) { this.PS = byte.set(this.PS, 4, value); this.logAction('Setting', 'Flag', 'Break', value); }

    protected get decimalFlag(): bit { return byte.get(this.PS, 3)? 1 : 0; }
    protected set decimalFlag(value: bit) { this.PS = byte.set(this.PS, 3, value); this.logAction('Setting', 'Flag', 'Decimal', value); }

    protected get interruptFlag(): bit { return byte.get(this.PS, 2)? 1 : 0; }
    protected set interruptFlag(value: bit) { this.PS = byte.set(this.PS, 2, value); this.logAction('Setting', 'Flag', 'Interrupt', value); }

    protected get zeroFlag(): bit { return byte.get(this.PS, 1)? 1 : 0; }
    protected set zeroFlag(value: bit) { this.PS = byte.set(this.PS, 1, value); this.logAction('Setting', 'Flag', 'Zero', value); }

    protected get carryFlag(): bit { return byte.get(this.PS, 0)? 1 : 0; }
    protected set carryFlag(value: bit) { this.PS = byte.set(this.PS, 0, value); this.logAction('Setting', 'Flag', 'Carry', value); }

    //---------------------------------------------------------------------------------
    //      Internals
    //---------------------------------------------------------------------------------

    /**
     * # Internal Instruction
     * 
     * ## - Internal
     * 
     * Used in this emulation of the processor to temporary store instructions between clock cycles and
     * therefor does not emulate the real hardwired logic of the processor.
     * 
     * @alias I_I
     */
    protected get internalInstruction(): byte { return byte(this.I_I); }
    protected set internalInstruction(data: number) { this.I_I = byte(data); this.logAction('Setting', 'Internal', 'Instruction', byte(data)); }

    /**
     * # Internal Address Data
     * 
     * ## - Internal
     * 
     * Used in this emulation of the processor to temporary store addresses between clock cycles and
     * therefor does not emulate the real hardwired logic of the processor.
     * 
     * @alias I_AD
     */
    protected get internalAddressData(): word { return word(this.I_AD); }
    protected set internalAddressData(data: number) { this.I_AD = word(data); this.logAction('Setting', 'Internal', 'Address Data', word(data)); }

    /**
     * # Internal Address Data Low
     * 
     * ## - Internal
     * 
     * Used in this emulation of the processor to temporary store addresses between clock cycles and
     * therefor does not emulate the real hardwired logic of the processor.
     * 
     * @alias I_ADL
     */
    protected get internalAddressDataLow(): byte { return byte(this.I_ADL); }
    protected set internalAddressDataLow(data: number) { this.I_ADL = byte(data); this.logAction('Setting', 'Internal', 'Address Data Low', byte(data)); }

    /**
     * # Internal Address Data High
     * 
     * ## - Internal
     * 
     * Used in this emulation of the processor to temporary store addresses between clock cycles and
     * therefor does not emulate the real hardwired logic of the processor.
     * 
     * @alias I_ADH
     */
    protected get internalAddressDataHigh(): byte { return byte(this.I_ADH); }
    protected set internalAddressDataHigh(data: number) { this.I_ADH = byte(data); this.logAction('Setting', 'Internal', 'Address Data High', byte(data)); }

    /**
     * # Internal Data Bus
     * 
     * ## - Internal
     * 
     * Used in this emulation of the processor to temporary store data between clock cycles and
     * therefor does not emulate the real hardwired logic of the processor.
     * 
     * @alias I_DB
     */
    protected get internalDataBus(): byte { return byte(this.I_DB); }
    protected set internalDataBus(data: number) { this.I_DB = byte(data); this.logAction('Setting', 'Internal', 'Data Bus', byte(data)); }

    //#################################################################################
    //#
    //#     PUBLIC VARIABLES
    //#
    //#################################################################################

    //---------------------------------------------------------------------------------
    //      Debuging
    //---------------------------------------------------------------------------------

    /**
     * # Debug
     * 
     * Used to debug the processor under emulation.
     */
    public debug: boolean;

    //---------------------------------------------------------------------------------
    //      Referances
    //---------------------------------------------------------------------------------

    /**
     * # Memory
     * 
     * A reference to the memory or **programable logic array**.
     * 
     * This is used to emulate how the processor is connected to memory.
     */
    public memory: MemoryLike;

    //---------------------------------------------------------------------------------
    //      Pins
    //---------------------------------------------------------------------------------

    /**
     * # Address Bus
     * 
     * ## Pin - A⁰ ⇨ A¹⁵
     * 
     * @alias AB
     */
    public get addressBus(): word { return word(this.IO_AB); }
    public set addressBus(data: number) { this.IO_AB = word(data); this.logAction('Setting', 'Pin', 'Address Bus', word(data)); }

    /**
     * # Address Bus Low
     * 
     * ## Pin - A⁸ ⇨ A¹⁵
     * 
     * @alias ABL
     */
    public get addressBusLow(): byte { return byte(this.IO_ABL); }
    public set addressBusLow(data: number) { this.IO_ABL = byte(data); this.logAction('Setting', 'Pin', 'Address Bus Low', byte(data)); }

    /**
     * # Address Bus High
     * 
     * ## Pin - A⁰ ⇨ A⁷
     * 
     * @alias ABH
     */
    public get addressBusHigh(): byte { return byte(this.IO_ABH); }
    public set addressBusHigh(data: number) { this.IO_ABH = byte(data); this.logAction('Setting', 'Pin', 'Address Bus High', byte(data)); }

    /**
     * # Data Bus
     * 
     * ## Pin - D⁰ ⇨ D⁷
     * 
     * @alias DB
     */
    public get dataBus(): byte { return byte(this.IO_DB); };
    public set dataBus(data: number) { this.IO_DB = byte(data); this.logAction('Setting', 'Pin', 'Data Bus', byte(data)); }

    //#################################################################################
    //#
    //#     PUBLIC FUNCTIONS
    //#
    //#################################################################################

    //---------------------------------------------------------------------------------
    //      Pins
    //---------------------------------------------------------------------------------

    /**
     * # Clock Input
     * 
     * ## Pin - 𝜃⁰
     */
    public clock(): void {
        this.logCall('Clock');

        if (this.sequences.length !== 0) {
            this.log('Working', '...', this.sequences.length);
            return this.nextSequence().call(this);
        }

        this.log('Loading Instruction');
        this.addressingProgramCounter();
        this.incrementProgramCounter();
        this.fetch();
        this.internalInstruction = this.dataBus;

        this.log('Cleanup Internals');
        this.internalAddressData = 0;
        this.internalDataBus = 0;

        this.log('Setup Sequences');
        this.addressings[this.internalInstruction].call(this);

        this.log('Done');
    }

    /**
     * # Interrupt Request
     * 
     * ## Pin - IRQ
     */
    public interruptRequest(): void {
        this.logCall('Interrupt Request');
        if (this.interruptFlag) this.breakFlag = 1;
        this.log('Done');
    }

    /**
     * # Non-Maskable Interrupt
     * 
     * ## Pin - NMI
     */
    public nonMaskableInterrupt(): void {
        this.logCall('Non-Maskable Interrupt');
        this.breakFlag = 1;
        this.log('Done');
    }

    /**
     * # Set Overflow
     * 
     * ## Pin - SO
     */
    public setOverflow(): void {
        this.logCall('Set Overflow');
        this.overflowFlag = 1;
        this.log('Done');
    }

    /**
     * # Reset
     * 
     * ## Pin - RES
     */
    public reset(): void {
        this.logCall('Reset');
        this.defaultState();
        this.log('Done');
    }

    //---------------------------------------------------------------------------------
    //      Debuging
    //---------------------------------------------------------------------------------

    public debugInfo(): void {
        let pc: word = this.programCounter;
        let ps: byte = this.statusRegister;
        let sp: byte = this.stackPointer;
        let a: byte = this.accumulator;
        let x: byte = this.indexX;
        let y: byte = this.indexY;
        let ir: byte = this.internalInstruction;
        let ad: word = this.internalAddressData;
        let ab: word = this.addressBus;
        let id: byte = this.internalDataBus;
        let db: byte = this.dataBus;

        let c0: string = foregroundColor(230, 25, 75);
        let c1: string = foregroundColor(60, 180, 75);
        let c2: string = foregroundColor(255, 225, 25);
        let c3: string = foregroundColor(0, 130, 200);
        let c4: string = foregroundColor(245, 130, 48);
        let c5: string = foregroundColor(145, 30, 180);
        let c6: string = foregroundColor(70, 240, 240);
        let c7: string = foregroundColor(240, 50, 230);
        let c8: string = foregroundColor(210, 245, 60);
        let c9: string = foregroundColor(0, 125, 125);
        let c10: string = foregroundColor(170, 110, 40);
        let c11: string = ForegroundColor.default;

        let result = format(
            ForegroundColor.green + CLASSNAME_DEFAULT + ForegroundColor.default, 'Debug Info', '\n',
            '0x' + c0 + word.toHexadecimal(pc)                               , c11, c0 + word.toArray(pc).join(' ')                                  , c11, pc, '\n',
            '0x' + c1 + byte.toHexadecimal(ps) + c2 + byte.toHexadecimal(sp) , c11, c1 + byte.toArray(ps).join(' '), c2 + byte.toArray(sp).join(' ') , c11, (ps << byte.size) + sp, '\n',
            '0x' + c3 + byte.toHexadecimal(ir) + c4 + byte.toHexadecimal(a)  , c11, c3 + byte.toArray(ir).join(' '), c4 + byte.toArray(a).join(' ')  , c11, (ir << byte.size) + a, '\n',
            '0x' + c5 + byte.toHexadecimal(x)  + c6 + byte.toHexadecimal(y)  , c11, c5 + byte.toArray(x).join(' ') , c6 + byte.toArray(y).join(' ')  , c11, (x << byte.size) + y, '\n',
            '0x' + c7 + word.toHexadecimal(ad)                               , c11, c7 + word.toArray(ad).join(' ')                                  , c11, ad, '\n',
            '0x' + c8 + word.toHexadecimal(ab)                               , c11, c8 + word.toArray(ab).join(' ')                                  , c11, ab, '\n',
            '0x' + c9 + byte.toHexadecimal(id) + c10 + byte.toHexadecimal(db), c11, c9 + byte.toArray(id).join(' ') + c10, byte.toArray(db).join(' '), c11, (id << byte.size) + db, '\n',
            '\n',
            c0, '█', ForegroundColor.default, 'Program Counter', '\n',
            c1, '█', ForegroundColor.default, 'Status Register', '\n',
            c2, '█', ForegroundColor.default, 'Stack Pointer', '\n',
            c3, '█', ForegroundColor.default, 'Intruction Register', '\n',
            c4, '█', ForegroundColor.default, 'Accumulator', '\n',
            c5, '█', ForegroundColor.default, 'Index X', '\n',
            c6, '█', ForegroundColor.default, 'Index Y', '\n',
            c7, '█', ForegroundColor.default, 'Internal Address Data', '\n',
            c8, '█', ForegroundColor.default, 'Address Bus', '\n',
            c9, '█', ForegroundColor.default, 'Internal Data Bus', '\n',
            c10,'█', ForegroundColor.default, 'Data Bus', '\n',
        );

        console.info(result);
    }

    public debugFlags(): void {
        let ps: byte = this.statusRegister;
        let result = format(
            ForegroundColor.green + CLASSNAME_DEFAULT + ForegroundColor.default, 'Debug', 'Flags', '\n',
            '\n',
            'C Z I D B - V N', '\n',
            byte.toArray(ps).join(' '), '\n',
            '\n',
            ' N ', 'Negative Flag', '\n',
            ' V ', 'Overflow Flag', '\n',
            ' B ', 'Break Flag', '\n',
            ' D ', 'Decimal Flag', '\n',
            ' I ', 'Interrupt Flag', '\n',
            ' Z ', 'Zero Flag', '\n',
            ' C ', 'Carry Flag', '\n',
        );

        console.info(result);
    }

    //#################################################################################
    //#
    //#     PROTECTED FUNCTIONS
    //#
    //#################################################################################

    //---------------------------------------------------------------------------------
    //      Functionality
    //---------------------------------------------------------------------------------

    protected defaultState(): void {
        this.log('Resetting to default state');

        this.programCounter = PROGRAM_COUNTER_DEFUALT;
        this.statusRegister = STATUS_REGISTER_DEFUALT;
        this.stackPointer = STACK_POINTER_DEFUALT;
        this.accumulator = ACCUMULATOR_DEFUALT;
        this.indexX = X_REGISTER_DEFUALT;
        this.indexY = Y_REGISTER_DEFUALT;
        this.internalInstruction = INSTRUCTION_REGISTER_DEFUALT;
        this.internalAddressData = INTERNAL_ADDRESS_DATA_DEFUALT;
        this.sequences = [];
        this.addressBus = ADDRESS_BUS_BUFFER_DEFUALT;
        this.dataBus = DATA_BUS_BUFFER_DEFUALT;
    }

    //---------------------------------------------------------------------------------
    //      Data Handling
    //---------------------------------------------------------------------------------

    /**
     * # Fetch
     * 
     * Used to emulate how data is transfered from memory to the processor.
     */
    protected fetch(): void {
        this.log('Reading Memory', '0x' + word.toHexadecimal(this.addressBus));
        this.dataBus = this.memory.read(this.addressBus);
    }

    /**
     * # Write
     * 
     * Used to emulate how data is thransfered from the processor to memory.
     */
    protected write(): void {
        this.log('Write', 'Memory', '0x' + word.toHexadecimal(this.addressBus));
        this.memory.write(this.addressBus, this.dataBus);
    }

    /**
     * # Set Internal Data Bus
     * 
     * Used for easily setting the **internal data bus** to **data bus**.
     */
    protected setInternalDataBus(): void {
        this.log('Setting ID = DB');
        this.internalDataBus = this.dataBus;
    }

    /**
     * # Load Internal Data Bus
     * 
     * Used for easily setting the **data bus** to **internal data bus**.
     */
    protected loadInternalDataBus(): void {
        this.log('Setting DB = ID');
        this.internalDataBus = this.dataBus;
    }

    //---------------------------------------------------------------------------------
    //      Program Counter
    //---------------------------------------------------------------------------------

    /**
     * # Addressing Program Counter
     * 
     * Used for easily setting the **address bus** to **program counter**.
     */
    protected addressingProgramCounter(): void {
        this.log('Setting AB = PC');
        this.addressBus = this.programCounter;
    }

    /**
     * # Set Program Counter
     * 
     * Used for easily setting the **program counter** to **internal address data**.
     */
    protected setProgramCounter(): void {
        this.log('Setting PC = AD');
        this.programCounter = this.internalAddressData;
    }

    /**
     * # Increment Program Counter
     * 
     * Used for easily setting the next opcode.
     */
    protected incrementProgramCounter(): void {
        this.log('Increment PC++');
        this.programCounter++;
    }

    //---------------------------------------------------------------------------------
    //      Address manupulation
    //---------------------------------------------------------------------------------

    /**
     * # Addressing Internal Address Data
     * 
     * Used for easily setting the **address bus** to **internal address data**.
     */
    protected addressingInternalAddressData(): void {
        this.log('Setting AB = AD');
        this.addressBus = this.internalAddressData;
    }

    /**
     * # Set Internal Address Data
     * 
     * Used for easily setting the **internal address data** to **program counter**.
     */
    protected setInternalAddressData(): void {
        this.log('Setting AD = PC');
        this.internalAddressData = this.programCounter;
    }

    /**
     * # Increment Address Bus
     * 
     * Used for easily setting the **address bus** to the next address.
     */
    protected incrementAddressBus(): void {
        this.log('Increment AB++');
        this.addressBus++;
    }

    //---------------------------------------------------------------------------------
    //      Sequence
    //---------------------------------------------------------------------------------

    protected addSequence(...callbacks: SequenceFunction[]): void {
        for(let index = callbacks.length - 1; index >= 0; index--) {
            let sequence = callbacks[index];
            this.logAction('Push', '', 'Sequence', sequence);
            this.sequences = [sequence, ... this.sequences];
        }
    }

    protected nextSequence(): SequenceFunction {
        let sequence = this.sequences.pop() || this.___;
        this.logAction('Pop', '', 'Sequence', sequence);
        return sequence;
    }

    //---------------------------------------------------------------------------------
    //      Debuging
    //---------------------------------------------------------------------------------

    protected log(...data: any[]) {
        if (this.debug) console.log(ForegroundColor.green + CLASSNAME_DEFAULT + ForegroundColor.default + ' ' + format(...data));
    }

    protected logAction(action: string, type: string, target: string, value: any): void {
        this.log(ForegroundColor.cyan + action, type, ForegroundColor.magenta + target + ForegroundColor.default, '=', value);
    }

    protected logCall(title: string): void {
        this.log(ForegroundColor.blue + Formatting.bold + title + Formatting.reset);
    }

    //---------------------------------------------------------------------------------
    //      Operations
    //---------------------------------------------------------------------------------

    /**
     * # Empty
     * 
     * Used for operations and addressings that is not implemented.
     */
    protected ___(): void {}

    /**
     * # Add Memory to Accumulator with Carry
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | ± | ± | . | . | . | . | ± | ± |
     */
    protected ADC(): void {}

    /**
     * # *AND* Memory with Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | ± | . | . | . | . | . | ± | . |
     */
    protected AND(): void {}

    /**
     * # Store Accumulator in Memory and Transfer Index X to Accumulator
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * Combination of {@link TXA} **Implied** and {@link AND} **Immediate**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | . |
     * 
     * @alias XAA
     */
    protected ANE(): void {}

    /**
     * # *AND* Memory with Accumulator and Shift left *One* Bit
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link AND} **Immediate** and {@link ASL} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     * 
     * @alias ANC
     */
    protected ANS(): void {}

    /**
     * # *AND* Memory with Accumulator and Rotate *One* Bit Left
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link AND} **Immediate** and {@link ROL} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     * 
     * @alias ANC
     */
    protected ANR(): void {}

    /**
     * # *AND* Memory with Accumulator and Rotate *One* Bit Right
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link AND} **Immediate** and {@link ROR} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | 0 | . | . | ? | . | 0 | ± |
     */
    protected ARR(): void {}

    /**
     * # Shift left *One* Bit (Memory or Accumulator)
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected ASL(): void {}

    /**
     * # *AND* Memory with Accumulator and Shift *One* Bit Right
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link AND} **Immediate** and {@link LSR} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     * 
     * @alias ALR
     */
    protected ASR(): void {}

    /**
     * # Branch on Carry *Clear*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BCC(): void {}

    /**
     * # Branch on Carry *Set*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BCS(): void {}

    /**
     * # Branch on Result *Zero*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BEQ(): void {}

    /**
     * # Test Bits in Memory with Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BIT(): void {}

    /**
     * # Branch on Result *Minus*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BMI(): void {}

    /**
     * # Branch on Result not *Zero*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BNE(): void {}

    /**
     * # Branch on Result *Plus*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BPL(): void {}

    /**
     * # Force *Break*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BRK(): void {}

    /**
     * # Branch on Overflow *Clear*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BVC(): void {}

    /**
     * # Branch on Overflow *Set*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected BVS(): void {}

    /**
     * # *Clear* Carry Flag
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CLC(): void {}

    /**
     * # *Clear* Decimal Mode
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CLD(): void {}

    /**
     * # *Clear* Interrupt Disable Status
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CLI(): void {}

    /**
     * # *Clear* Overflow Flag
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CLV(): void {}

    /**
     * # Compare Memory and Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CMP(): void {}

    /**
     * # Compare Memory and Index X
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CPX(): void {}

    /**
     * # Compare Memory and Index Y
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected CPY(): void {}

    /**
     * # Decrement Memory by *One* and Compare Memory and Accumulator
     * 
     * ## - Illigal Operation
     * 
     * Compination of {@link DEC} and {@link CMP}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     */
    protected DCP(): void {}

    /**
     * # Decrement Memory by *One*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected DEC(): void {}

    /**
     * # Decrement Index X by *One*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected DEX(): void {}

    /**
     * # Decrement Index Y by *One*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected DEY(): void {}

    /**
     * # *Exclusive-or* Memory with Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected EOR(): void {}

    /**
     * # Increment Memory by *One*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected INC(): void {}

    /**
     * # Increment Index X by *One*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected INX(): void {}

    /**
     * # Increment Index Y by *One*
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected INY(): void {}

    /**
     * # Increment Memory by *One* and Subtract Memory from Accumulator with Borrow
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link INC} and {@link SBC}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | 0 | . | . | I | . | 0 | X |
     * 
     * @alias ISC
     */
    protected ISB(): void {}

    /**
     * # Halt the CPU
     * 
     * ## - Illigal Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     * 
     * @note **Data Bus Buffer** will be set to 0xFF.
     * @alias CRS
     * @alias HLT
     * @alias KIL
     */
    protected JAM(): void {}

    /**
     * # Jump to *New* Location
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected JMP(): void {}

    /**
     * # Jump to *New* Location Saving *Return* Address
     * 
     * ## - Operation
     */
    protected JSR(): void {}

    /**
     * # Load Accumulator with Memory and Load Index X with Memory
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link LDA} and {@link LDX}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | . |
     */
    protected LAX(): void {}

    /**
     * # Load Accumulator with Memory
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected LDA(): void {}

    /**
     * # Load Index X with Memory
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected LDX(): void {}

    /**
     * # Load Index Y with Memory
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected LDY(): void {}

    /**
     * # Store Memory and Stack Pointer into Accumulator, Index X and Stack Pointer
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * Combination of {@link STA}/{@link TXS} and {@link LDA}/{@link TSX}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | . |
     * 
     * @alias LAS
     * @alias LAR
     */
    protected LEA(): void {}

    /**
     * # Shift *One* Bit Right (Memory or Accumulator)
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected LSR(): void {}

    /**
     * # Load Accumulator with Memory and Transfer Accumulator to Index X
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * Compination of {@link LDA} **Immediate** and {@link TAX} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | . |
     * 
     * @alias LAX
     */
    protected LXA(): void {}

    /**
     * # No Operation
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected NOP(): void {}

    /**
     * # *OR* Memory with Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected ORA(): void {}

    /**
     * # Push Accumulator on Stack
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected PHA(): void {}

    /**
     * # Push Processor Status on Stack
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected PHP(): void {}

    /**
     * # Pull Accumulator from Stack
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected PLA(): void {}

    /**
     * # Pull Processor Status from Stack
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected PLP(): void {}

    /**
     * # Rotate *One* Bit Left (Memory or Accumulator)
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected ROL(): void {}

    /**
     * # Rotate *One* Bit Right (Memory or Accumulator)
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected ROR(): void {}

    /**
     * # *Return* from Interrupt
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected RTI(): void {}

    /**
     * # *Return* from Subroutine
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected RTS(): void {}

    /**
     * # Subtract Memory from Accumulator with Borrow
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link SBC} **Immediate** and {@link NOP} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | 0 | . | . | I | . | 0 | X |
     * 
     * @alias SBC
     */
    protected USB(): void {}

    /**
     * # Store Accumulator and Index X in Memory at same time
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link STA} and {@link STX}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected SAX(): void {}

    /**
     * # Subtract Memory from Accumulator with Borrow
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected SBC(): void {}

    /**
     * # *AND* Accumulator with Index X then Subtract Operand and Store in Index X
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link CMP} **Immediate** and {@link DEX} **Implied**.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     * 
     * @alias AXS
     */
    protected SBX(): void {}

    /**
     * # *Set* Carry Flag
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected SEC(): void {}
    /**
     * # *Set* Decimal Mode
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected SED(): void {}

    /**
     * # *Set* Interrupt Disable Status
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected SEI(): void {}

    /**
     * # Store Accumulator, Index X and Program Counter high order byte in Memory
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     * 
     * Combination of {@link STA}/{@link STX}/{@link STY}.
     * 
     * @alias AHX
     */
    protected SHA(): void {}

    /**
     * # Store Index X and Program Counter high order byte in Memory
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     * 
     * Combination of {@link STA}/{@link STX}/{@link STY}.
     */
    protected SHX(): void {}

    /**
     * # Store Index Y and Program Counter high order byte in Memory
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     * 
     * Combination of {@link STA}/{@link STX}/{@link STY}.
     */
    protected SHY(): void {}

    /**
     * # Shift left *One* Bit in Memory then *OR* Accumulator with Memory
     * 
     * ## - Illigal Operation
     * 
     * The left most bit is shifted into the **carry** flag, then clearing **negative** and **zero** flags.
     * 
     * The **carry** flag will always result in being cleared in this operation, since the operation happens on the memory.
     * 
     * Combination of {@link ASL} and {@link ORA}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     * 
     * @alias ASO
     */
    protected SLO(): void {}

    /**
     * # Store Accumulator in Memory
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected STA(): void {}

    /**
     * # Store Index X in Memory
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected STX(): void {}

    /**
     * # Store Index Y in Memory
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected STY(): void {}

    /**
     * # Shift *One* Bit Right Memory and Exclusive-or Memory with Accumulator
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link LSR} and {@link EOR}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | 0 |
     * 
     * @alias LSE
     */
    protected SRE(): void {}

    /**
     * # Store Accumulator and Index X into Stack Pointer and Accumulator, Index X and high order byte into Memory
     * 
     * ## - Illigal Operation 'Unstable'
     * 
     * Combination of {@link STA}/{@link TXS} and {@link LDA}/{@link TSX}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TAS(): void {}

    /**
     * # Transfer Accumulator to Index X
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TAX(): void {}

    /**
     * # Transfer Accumulator to Index Y
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TAY(): void {}

    /**
     * # Transfer Stack Pointer to Index X
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TSX(): void {}

    /**
     * # Transfer Index X to Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TXA(): void {}

    /**
     * # Transfer Index X to Stack Pointer
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TXS(): void {}

    /**
     * # Transfer Index Y to Accumulator
     * 
     * ## - Operation
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | . | . | . | . | . | . | . | . |
     */
    protected TYA(): void {}

    /**
     * # Rotate One Bit Left Memory and AND Memory with Accumulator
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link ROL} and {@link AND}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | . | . | . | . | . | 0 | X |
     */
    protected RLA(): void {}

    /**
     * # Rotate One Bit Right Memory and Add Memory to Accumulator with Carry
     * 
     * ## - Illigal Operation
     * 
     * Combination of {@link ROR} and {@link ADC}.
     * 
     * | N | V | - | B | D | I | Z | C |
     * |:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
     * | 0 | 0 | . | . | I | . | 0 | X |
     */
    protected RRA(): void {}

    //---------------------------------------------------------------------------------
    //      Addressings
    //---------------------------------------------------------------------------------

    /**
     * # Accumulator
     * 
     * ## - Addressing
     * 
     * This from of addressing is represented with a *one* byte instruction, implying an operation on the **accumulator**.
     */
    protected ACU(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            operation();
        }

        this.addSequence(T1);
    }

    /**
     * # Immediate
     * 
     * ## - Addressing
     * 
     * In **immediate** addressing, the [operand](https://en.wikipedia.org/wiki/Operand) is contained in the *second* byte of the instruction,
     * with no further memory addressing required.
     */
    protected IMM(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            operation();
        }

        this.addSequence(T1);
    }

    /**
     * # Implied
     * 
     * ## - Addressing
     * 
     * In the **implied** addressing mode, the address containing the [operand](https://en.wikipedia.org/wiki/Operand) is implicitly stated
     * in the operation code of the instruction.
     */
    protected IMP(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            operation();
        }

        this.addSequence(T1);
    }

    /**
     * # Absolute
     * 
     * ## - Addressing
     * 
     * In **absolute** addressing, the *second* byte of the instruction specifies the *eight* low order bits of the effective address
     * while the *third* byte specifies the *eight* high order bits.
     * 
     * Thus, the **absolute** addressing mode allows access to the entire *65K* bytes of addressable memory.
     */
    protected ABS(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T3 = () => {
            this.internalAddressDataHigh = this.internalDataBus;
            this.addressingInternalAddressData();
            operation();
        }

        this.addSequence(T1, T2, T3);
    }

    /**
     * # X Indexed Absolute
     * 
     * ## - Addressing
     * 
     * This form of addressing is used in conjunction with **X index** register  and is referred to as 'Absolute, X'.
     * 
     * The effective address is formed by adding the contents of **X index** to the address contained in the *second* and *third* bytes
     * of the instruction.
     * 
     * This mode allows the **X index** register to contain the base address.
     * 
     * This type of indexing allows any location referencing and the **X index** to modify multiple fields resulting in reduced coding and
     * execution time.
     */
    protected ABX(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T3 = () => {
            this.internalAddressDataHigh = this.internalDataBus;
            this.internalAddressData += this.indexX;
            this.addressingInternalAddressData();

            let pageCrossing: boolean = (this.internalAddressDataHigh << byte.size) !== this.internalDataBus;
            let T4 = () => {
                operation();
            }

            if (!pageCrossing) operation();
            if (pageCrossing) this.addSequence(T4);
        }

        this.addSequence(T1, T2, T3);
    }

    /**
     * # Y Indexed Absolute
     * 
     * ## - Addressing
     * 
     * This form of addressing is used in conjunction with **Y index** register  and is referred to as 'Absolute, Y'.
     * 
     * The effective address is formed by adding the contents of **Y index** to the address contained in the *second* and *third* bytes
     * of the instruction.
     * 
     * This mode allows the **Y index** register to contain the base address.
     * 
     * This type of indexing allows any location referencing and the **Y index** to modify multiple fields resulting in reduced coding and
     * execution time.
     */
    protected ABY(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T3 = () => {
            this.internalAddressDataHigh = this.internalDataBus;
            this.internalAddressData += this.indexY;
            this.addressingInternalAddressData();

            let pageCrossing: boolean = (this.internalAddressDataHigh << byte.size) !== this.internalDataBus;
            let T4 = () => {
                operation();
            }

            if (!pageCrossing) operation();
            if (pageCrossing) this.addSequence(T4);
        }

        this.addSequence(T1, T2, T3);
    }

    /**
     * # Zero page
     * 
     * ## - Addressing
     * 
     * The **zero page** instructions allow for shorter code and execution times by only fetching the *second* byte of the instruction and
     * assuming a *zero* high address byte.
     * 
     * Careful use of the **zero page** can result in significant increase in code efficiency.
     */
    protected ZPG(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingInternalAddressData();
            operation();
        }

        this.addSequence(T1, T2);
    }

    /**
     * # X Indexed Zero page
     * 
     * ## - Addressing
     * 
     * This form of addressing is used in conjunction with the **X index** register and is referred to as 'Zero Page, X'.
     * 
     * The effective address is calculated by adding the *second* byte to the contents of the **X index** register.
     * 
     * Since this is a form of **zero page** addressing, content of the *second* byte references a location in page *zero*.
     * 
     * Additionally due to the **zero page** addressing nature of this mode, no **carry** is added to the high order *eight* bits of memory
     * and crossing of page boundaries does not occur.
     */
    protected ZPX(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingInternalAddressData();
            this.fetch();
        }
        let T3 = () => {
            this.internalAddressDataLow += this.indexX;
            this.addressingInternalAddressData();
            operation();
        }

        this.addSequence(T1, T2, T3);
    }

    /**
     * # Y Indexed Zero page
     * 
     * ## - Addressing
     * 
     * This form of addressing is used in conjunction with the **Y index** register and is referred to as 'Zero Page, Y'.
     * 
     * The effective address is calculated by adding the *second* byte to the contents of the **Y index** register.
     * 
     * Since this is a form of **zero page** addressing, content of the *second* byte references a location in page *zero*.
     * 
     * Additionally due to the **zero page** addressing nature of this mode, no **carry** is added to the high order *eight* bits of memory
     * and crossing of page boundaries does not occur.
     */
    protected ZPY(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingInternalAddressData();
            this.fetch();
        }
        let T3 = () => {
            this.internalAddressDataLow += this.indexY;
            this.addressingInternalAddressData();
            operation();
        }

        this.addSequence(T1, T2, T3);
    }

    /**
     * # Indexed Indirect
     * 
     * ## - Addressing
     * 
     * In **indexed indirect** addressing (referred to as '[Indirect, X]'), the *second* byte of the instruction is added the contents of
     * the **X index** register, discarding the **carry**.
     * 
     * The result of the addition points to a memory location on page *zero* whose contents is the low order *eight* bits of the effective
     * address.
     * 
     * The next memory location in page *zero* contains the high order *eight* bits of the effective address.
     * 
     * Both memory locations specifying the high ans low order bytes of the effective address must be in page *zero*.
     */
    protected IDX(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingInternalAddressData();
            this.fetch();
        }
        let T3 = () => {
            this.internalAddressDataLow += this.indexX;
            this.addressingInternalAddressData();
            this.fetch();
            this.setInternalDataBus();
        }
        let T4 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.incrementAddressBus();
            this.fetch();
            this.setInternalDataBus();
        }
        let T5 = () => {
            this.internalAddressDataHigh = this.internalDataBus;
            this.addressingInternalAddressData();
            operation();
        }

        this.addSequence(T1, T2, T3, T4, T5);
    }

    /**
     * # Indirect Indexed
     * 
     * ## - Addressing
     * 
     * In **indirect indexed** addressing (referred to as '[Indirect], Y'), the *second* byte of the instruction points to a memory location
     * in page *zero*.
     * 
     * The contents of the memory location is added to the contents of the **Y index** register, the result being the low order *eight* bits
     * of the affective address.
     * 
     * The **carry** from this addition is added to the contents of the next page *zero* memory location, the result being the high order
     * *eight* bits of the effective address.
     */
    protected IDY(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
        }
        let T2 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.addressingInternalAddressData();
            this.fetch();
            this.setInternalDataBus();
        }
        let T3 = () => {
            this.internalAddressDataLow = this.internalDataBus;
            this.incrementAddressBus();
            this.fetch();
            this.setInternalDataBus();
        }
        let T4 = () => {
            this.internalAddressDataHigh = this.internalDataBus;
            this.internalAddressData += this.indexY;
            this.addressingInternalAddressData();

            let pageCrossing: boolean = (this.internalAddressDataHigh << byte.size) !== this.internalDataBus;
            let T5 = () => {
                operation();
            }

            if (!pageCrossing) operation();
            if (pageCrossing) this.addSequence(T5);
        }

        this.addSequence(T1, T2, T3, T4);
    }

    /**
     * # Relative
     * 
     * ## - Addressing
     * 
     * **Relative** addressing is used only with **branch** instructions and establishes a distination for conditional branch.
     * 
     * The *second* byte of the instruction becomes the [operand](https://en.wikipedia.org/wiki/Operand) which is an *offset* added to
     * the contents of the lower *eight* bits of the **program counter** when the counter is set at next instruction.
     * 
     * The range of the *offset* is *-128* to *127* bytes from the next instruction.
     */
    protected REL(): void {
        let operation = this.operations[this.internalInstruction];
        let T1 = () => {
            this.addressingProgramCounter();
            this.incrementProgramCounter();
            this.fetch();
            this.setInternalDataBus();
            operation();
        }
        this.addSequence(T1);
    }
}