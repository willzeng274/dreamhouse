const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
	floorplan: {
		async generate(sketchFile: File): Promise<Blob> {
			const formData = new FormData();
			formData.append("sketch", sketchFile);

			const response = await fetch(`${API_BASE_URL}/floorplan/generate`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Failed to generate floorplan: ${response.statusText}`);
			}

			return response.blob();
		},

		async extract(floorplanFile: File): Promise<{ objects: any[]; boundaries: any[] }> {
			const formData = new FormData();
			formData.append("floorplan", floorplanFile);

			// Verbose logging for debugging
			console.log("=== EXTRACT ENDPOINT: Sending to Backend ===");
			console.log("Endpoint:", `${API_BASE_URL}/floorplan/extract`);
			console.log("File name:", floorplanFile.name);
			console.log("File size:", floorplanFile.size, "bytes");
			console.log("File type:", floorplanFile.type);

			// Convert file to base64 for logging
			const reader = new FileReader();
			const base64Promise = new Promise<string>((resolve) => {
				reader.onload = (e) => {
					const dataUrl = e.target?.result as string;
					resolve(dataUrl);
				};
				reader.readAsDataURL(floorplanFile);
			});

			const base64Data = await base64Promise;
			console.log("Base64 image data URL:", base64Data);
			console.log("Full base64 length:", base64Data.length);
			console.log("Note: Extract endpoint does not use a text prompt parameter");
			console.log("=========================================");

			const response = await fetch(`${API_BASE_URL}/floorplan/extract`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Failed to extract objects: ${response.statusText}`);
			}

			const result = await response.json();
			console.log("=== EXTRACT ENDPOINT: Response ===");
			console.log("Objects extracted:", result.objects?.length || 0);
			console.log("Boundaries extracted:", result.boundaries?.length || 0);
			console.table(result.objects?.slice(0, 5)); // Log first 5 objects
			console.log("=========================================");

			return result;
		},

		async revise(
			floorplanFile: File,
			instruction: string
		): Promise<Blob> {
			const formData = new FormData();
			formData.append("annotated_floorplan", floorplanFile);
			formData.append("instruction", instruction);

			const response = await fetch(`${API_BASE_URL}/floorplan/revise`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Failed to revise floorplan: ${response.statusText}`);
			}

			return response.blob();
		},
	},

	image: {
		async generate(floorplanFile: File): Promise<Blob> {
			const formData = new FormData();
			formData.append("floorplan", floorplanFile);

			const response = await fetch(`${API_BASE_URL}/image/generate`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error(
					`Failed to generate photorealistic image: ${response.statusText}`
				);
			}

			return response.blob();
		},
	},

	scene: {
		async export(objects: any[]): Promise<{ unity_scene: any }> {
			const response = await fetch(`${API_BASE_URL}/scene/export`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(objects),
			});

			if (!response.ok) {
				throw new Error(`Failed to export scene: ${response.statusText}`);
			}

			return response.json();
		},
	},
};
