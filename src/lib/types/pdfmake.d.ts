declare module 'pdfmake/build/pdfmake' {
	interface TDocumentDefinitions {
		content: any;
		styles?: Record<string, any>;
		defaultStyle?: Record<string, any>;
		pageSize?: string;
		pageMargins?: number[];
	}

	interface PdfDocGenerator {
		getBase64(callback: (data: string) => void): void;
		download(filename?: string): void;
		open(): void;
	}

	interface PdfMake {
		createPdf(
			documentDefinition: TDocumentDefinitions,
			tableLayouts?: any,
			fonts?: Record<string, any>
		): PdfDocGenerator;
	}

	const pdfMake: PdfMake;
	export default pdfMake;
}
