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

			const response = await fetch(`${API_BASE_URL}/floorplan/extract`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Failed to extract objects: ${response.statusText}`);
			}

			return response.json();
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
