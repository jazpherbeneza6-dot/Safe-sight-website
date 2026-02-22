import { NextRequest, NextResponse } from "next/server";
import { Storage } from "megajs";

// Required for Next.js static export with API routes
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "No URL provided" }, { status: 400 });
        }

        const email = process.env.MEGA_EMAIL;
        const password = process.env.MEGA_PASSWORD;

        if (!email || !password) {
            return NextResponse.json({ error: "Mega credentials not configured" }, { status: 500 });
        }

        // Initialize Mega storage
        const storage = new Storage({
            email,
            password,
        });

        await new Promise<void>((resolve, reject) => {
            storage.ready.then(() => resolve()).catch(reject);
        });

        // Extract file name from URL to find in storage
        // Mega URLs are typically: https://mega.nz/file/[fileId]#[key]
        // We need to search through storage to find matching file

        let fileToDelete: any = null;
        const allFiles: any[] = [];

        // Recursively collect all files from storage
        const collectFiles = (node: any) => {
            if (node.children) {
                for (const child of node.children) {
                    if (child.directory) {
                        collectFiles(child);
                    } else {
                        allFiles.push(child);
                    }
                }
            }
        };

        collectFiles(storage.root);

        // Try to match by generating file link and comparing
        for (const file of allFiles) {
            try {
                const fileLink = await file.link();
                if (fileLink === url) {
                    fileToDelete = file;
                    break;
                }
            } catch (e) {
                // Skip files that can't generate links
                continue;
            }
        }

        if (!fileToDelete) {
            // File might already be deleted or not found
            console.log("File not found in storage, might be already deleted");
            return NextResponse.json({
                success: true,
                message: "File not found or already deleted"
            });
        }

        // Delete the file
        const permanently = true; // true = permanent delete, false = move to trash
        await new Promise<void>((resolve, reject) => {
            try {
                // Use the unlink method which is available on file nodes
                if (fileToDelete.delete) {
                    fileToDelete.delete(permanently, (err: any) => {
                        if (err) {
                            console.error("Delete error:", err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    // Fallback: file might already be deleted
                    resolve();
                }
            } catch (error) {
                console.error("Delete exception:", error);
                reject(error);
            }
        });

        return NextResponse.json({
            success: true,
            message: "File deleted successfully from Mega.nz"
        });

    } catch (error: any) {
        console.error("Mega delete error:", error);
        return NextResponse.json({
            error: error.message || "Delete failed",
            success: false
        }, { status: 500 });
    }
}
