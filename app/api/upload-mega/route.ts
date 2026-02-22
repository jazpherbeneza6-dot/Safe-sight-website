import { NextRequest, NextResponse } from "next/server";
import { Storage } from "megajs";

// Required for Next.js static export with API routes
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const email = process.env.MEGA_EMAIL;
        const password = process.env.MEGA_PASSWORD;

        if (!email || !password) {
            return NextResponse.json({ error: "Mega credentials not configured" }, { status: 500 });
        }

        const storage = new Storage({
            email,
            password,
        });

        await new Promise<void>((resolve, reject) => {
            storage.ready.then(() => resolve()).catch(reject);
        });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = `${Date.now()}-${file.name}`;

        // Upload to root
        const uploadStream = storage.upload({
            name: filename,
            size: buffer.length
        }, buffer);

        const uploadedFile: any = await new Promise((resolve, reject) => {
            uploadStream.on('complete', (file: any) => resolve(file));
            uploadStream.on('error', (err: any) => reject(err));
        });

        const link = await uploadedFile.link();

        return NextResponse.json({ url: link });
    } catch (error: any) {
        console.error("Mega upload error:", error);
        
        // Provide more helpful error messages
        let errorMessage = error.message || "Upload failed";
        
        if (errorMessage.includes("EBLOCKED") || errorMessage.includes("User blocked")) {
            errorMessage = "EBLOCKED (-16): User blocked. The Mega.nz account is blocked. Please check your Mega.nz account status or use a different storage service.";
        } else if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
            errorMessage = "Mega.nz account not found. Please check your credentials.";
        } else if (errorMessage.includes("EKEY")) {
            errorMessage = "Invalid Mega.nz credentials. Please check your email and password.";
        } else if (errorMessage.includes("ETOOMANY")) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
        }
        
        return NextResponse.json({ 
            error: errorMessage,
            code: error.code || error.errno || "UNKNOWN_ERROR"
        }, { status: 500 });
    }
}
