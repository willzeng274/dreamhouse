export interface FloorplanObject {
	type: string;
	position: {
		x: number;
		y: number;
	};
	dimensions?: {
		width: number;
		height: number;
	};
	[key: string]: any;
}

export interface UnityScene {
	objects: any[];
	[key: string]: any;
}

export interface Annotation {
	id: string;
	x: number;
	y: number;
	text: string;
}
