// Web Bluetooth ESC/POS & Standard Text Printer Service
// Supports thermal Bluetooth receipt printers (58mm/80mm ESC/POS) and GATT Bluetooth serial services.

export interface BluetoothPrinterStatus {
  connected: boolean;
  deviceName?: string;
  error?: string;
}

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export function buildEscPosWorkOrderPayload(
  shopName: string,
  ticketNum: string,
  invoiceNum: string,
  createdDate: string,
  customerName: string,
  customerPhone: string,
  bikeDetails: string,
  serviceTitle: string,
  items: { description: string; quantity: number; rate: number; amount: number }[],
  subtotal: number,
  supplies: number,
  tax: number,
  total: number,
  notes?: string
): Uint8Array {
  const encoder = new TextEncoder();
  const buffer: number[] = [];

  // Helper to add ASCII bytes
  const addText = (text: string) => {
    const bytes = encoder.encode(text);
    bytes.forEach((b) => buffer.push(b));
  };

  const addBytes = (...bytes: number[]) => {
    bytes.forEach((b) => buffer.push(b));
  };

  // Initialize printer
  addBytes(ESC, 0x40);

  // Center align header
  addBytes(ESC, 0x61, 1);
  addBytes(ESC, 0x21, 0x30); // Double height & width
  addText(`${shopName}\n`);
  addBytes(ESC, 0x21, 0x00); // Normal text
  addText("3D LASER FRAME & CHASSIS ALIGNMENT\n");
  addText("--------------------------------\n");

  // Left align body
  addBytes(ESC, 0x61, 0);
  addBytes(ESC, 0x45, 1); // Bold on
  addText(`WORK ORDER #: ${invoiceNum}\n`);
  addText(`TICKET #:     ${ticketNum}\n`);
  addBytes(ESC, 0x45, 0); // Bold off
  addText(`DATE:         ${createdDate}\n`);
  addText(`RIDER:        ${customerName}\n`);
  addText(`PHONE:        ${customerPhone}\n`);
  addText(`BIKE:         ${bikeDetails}\n`);
  addText(`JOB:          ${serviceTitle}\n`);
  addText("--------------------------------\n");

  // Itemized List Header
  addBytes(ESC, 0x45, 1);
  addText("ITEM                     QTY    TOTAL\n");
  addBytes(ESC, 0x45, 0);
  addText("--------------------------------\n");

  items.forEach((item) => {
    const desc = item.description.length > 18 ? item.description.slice(0, 18) : item.description.padEnd(18, ' ');
    const qty = item.quantity.toString().padStart(4, ' ');
    const amt = `$${item.amount.toFixed(2)}`.padStart(8, ' ');
    addText(`${desc} ${qty} ${amt}\n`);
  });

  addText("--------------------------------\n");
  addText(`SUBTOTAL:             $${subtotal.toFixed(2).padStart(8, ' ')}\n`);
  addText(`SHOP SUPPLIES:        $${supplies.toFixed(2).padStart(8, ' ')}\n`);
  addText(`SALES TAX:            $${tax.toFixed(2).padStart(8, ' ')}\n`);
  addBytes(ESC, 0x45, 1);
  addBytes(ESC, 0x21, 0x10); // Double height
  addText(`TOTAL DUE:            $${total.toFixed(2)}\n`);
  addBytes(ESC, 0x21, 0x00); // Normal
  addBytes(ESC, 0x45, 0);

  if (notes) {
    addText("--------------------------------\n");
    addText(`MECHANIC NOTES:\n${notes}\n`);
  }

  addText("\n--------------------------------\n");
  addBytes(ESC, 0x61, 1); // Center
  addText("CUSTOMER SIGNATURE:\n\n\n\n");
  addText("X_______________________________\n");
  addText("Thank you for riding safe!\n\n\n\n");

  // Paper cut command (GS V 66 0)
  addBytes(GS, 0x56, 66, 0);

  return new Uint8Array(buffer);
}

// Check Web Bluetooth Support
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

// Global active printer bluetooth device reference
let activeGattServer: any = null;
let activeCharacteristic: any = null;
let activeDeviceName: string = '';

export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName: string; error?: string }> {
  if (!isWebBluetoothSupported()) {
    return {
      success: false,
      deviceName: '',
      error: 'Web Bluetooth is not supported in this browser. You can still print to Bluetooth printers via System Print (AirPrint / Windows / Android Bluetooth spooler).',
    };
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard Serial/Printer Service
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Zebra/Star Service
        '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
      ],
    });

    if (!device) {
      throw new Error('No Bluetooth printer selected.');
    }

    activeDeviceName = device.name || 'Bluetooth Work Order Printer';

    const server = await device.gatt.connect();
    activeGattServer = server;

    // Discover services & characteristics
    const services = await server.getPrimaryServices();
    let foundChar: any = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          foundChar = char;
          break;
        }
      }
      if (foundChar) break;
    }

    if (!foundChar) {
      throw new Error('Found Bluetooth device, but no writeable printer data channel was exposed.');
    }

    activeCharacteristic = foundChar;

    return {
      success: true,
      deviceName: activeDeviceName,
    };
  } catch (err: any) {
    console.warn('Bluetooth connection error:', err);
    return {
      success: false,
      deviceName: '',
      error: err.message || 'Failed to connect to Bluetooth printer.',
    };
  }
}

export async function sendPayloadToBluetoothPrinter(payload: Uint8Array): Promise<{ success: boolean; error?: string }> {
  if (!activeGattServer || !activeGattServer.connected || !activeCharacteristic) {
    // Attempt auto-reconnect or report disconnected
    return {
      success: false,
      error: 'Bluetooth printer is disconnected. Please click "Pair Bluetooth Printer" to connect your shop printer.',
    };
  }

  try {
    // Chunk payload to 512 bytes (GATT MTU constraint safely handled)
    const chunkSize = 100;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      if (activeCharacteristic.properties.writeWithoutResponse) {
        await activeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await activeCharacteristic.writeValue(chunk);
      }
      // Brief delay between chunks for thermal printer buffer
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send data to Bluetooth printer:', err);
    return {
      success: false,
      error: err.message || 'Bluetooth transmission error. Ensure printer is turned on and in range.',
    };
  }
}

export function getActiveBluetoothDeviceName(): string {
  if (activeGattServer && activeGattServer.connected) {
    return activeDeviceName || 'Bluetooth Printer Connected';
  }
  return '';
}
