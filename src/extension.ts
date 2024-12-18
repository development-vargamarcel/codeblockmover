import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Creates a regex pattern based on the provided start and end parts.
 * @param stringStartPart - The starting string (can include special characters and new lines).
 * @param stringEndPart - The ending string (can include special characters and new lines).
 * @returns A RegExp object that matches any text between the start and end parts.
 */
function createRegex(
	stringStartPart: string,
	stringEndPart: string
): RegExp {
	// Helper function to escape special characters for regex
	const escapeRegex = (str: string): string =>
		str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	// Escape the input strings to handle special characters and new lines
	const escapedStart = escapeRegex(stringStartPart);
	const escapedEnd = escapeRegex(stringEndPart);

	// Construct the regex pattern
	const pattern = `${escapedStart}[\\s\\S]*?${escapedEnd}`;

	// Return a RegExp object
	return new RegExp(pattern, "g");
}

// Example usage
//const regex = createRegex("/** @type", "$props();");

const createRegexGivenRegexPatternOrSearchParameters = (regexPatternOrSearchParameters: string): RegExp => {
	if (regexPatternOrSearchParameters.includes(' ... ')) {
		const regexCreationArguments: string[] = regexPatternOrSearchParameters.split(' ... ') || [];
		return createRegex(regexCreationArguments[0], regexCreationArguments[1]);
	} else {
		return new RegExp(regexPatternOrSearchParameters, 'm');
	}
};
function isBinaryFile(uri: vscode.Uri): boolean {
	const fileContent = fs.readFileSync(uri.fsPath);
	return fileContent.some(byte => byte > 127); // Check for non-ASCII characters
}
export function activate(context: vscode.ExtensionContext) {

	// Command to move code block based on user regexes in selected folder
	let moveBlockInFolderCommand = vscode.commands.registerCommand('codeBlockMover.moveBlockInFolder', async () => {
		// Prompt the user to select a folder
		const folderUri = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Folder'
		});

		if (!folderUri || folderUri.length === 0) {
			vscode.window.showErrorMessage("No folder selected.");
			return;
		}

		const folderPath = folderUri[0].fsPath;

		// Get stored regex patterns from the configuration
		const config = vscode.workspace.getConfiguration('codeBlockMover');
		const defaultSourceRegexPatternOrSearchParameters = config.get<string>('sourceRegexOrSearchParameters') || '';
		const defaultDestinationRegexPatternOrSearchParameters = config.get<string>('destinationRegexOrSearchParameters') || '';

		// Prompt for source regex, default to configuration if available
		const sourceRegexPatternOrSearchParameters = await vscode.window.showInputBox({
			prompt: 'Enter the regex to select the code block',
			value: defaultSourceRegexPatternOrSearchParameters,
		});
		if (!sourceRegexPatternOrSearchParameters) {
			vscode.window.showErrorMessage("Source regex pattern is required");
			return;
		}

		// Prompt for destination regex, default to configuration if available
		const destinationRegexPatternOrSearchParameters = await vscode.window.showInputBox({
			prompt: 'Enter the regex to find the destination line',
			value: defaultDestinationRegexPatternOrSearchParameters,
		});
		if (!destinationRegexPatternOrSearchParameters) {
			vscode.window.showErrorMessage("Destination regex pattern is required");
			return;
		}


		// Compile the regular expressions
		const sourceRegex = createRegexGivenRegexPatternOrSearchParameters(sourceRegexPatternOrSearchParameters);
		const destinationRegex = createRegexGivenRegexPatternOrSearchParameters(destinationRegexPatternOrSearchParameters);

		// Read all files in the selected folder
		const files = getFilesInDirectory(folderPath);
		if (files.length === 0) {
			vscode.window.showErrorMessage("No files found in the selected folder.");
			return;
		}

		// Process each file in the folder
		for (const file of files) {
			if (isBinaryFile(file)) {
				vscode.window.showErrorMessage(`File ${file.fsPath} is a binary file and cannot be processed.`);
				continue;

			}
			const document = await vscode.workspace.openTextDocument(file);
			const editor = await vscode.window.showTextDocument(document);

			const text = document.getText();
			console.log('Processing file:', file.fsPath, { text });

			// Find the code block
			const sourceMatch = sourceRegex.exec(text);
			if (!sourceMatch) {
				//vscode.window.showErrorMessage(`No code block matched the source regex in file ${file.fsPath} ${sourceMatch} ${sourceRegex}`);
				console.log('No code block matched the source regex in file', file.fsPath, sourceMatch, sourceRegex, { text });
				continue;
			}
			const codeBlock = sourceMatch[0];
			const codeBlockStart = document.positionAt(sourceMatch.index);
			const codeBlockEnd = document.positionAt(sourceMatch.index + codeBlock.length);

			// Find the destination line
			const destinationMatch = destinationRegex.exec(text);
			if (!destinationMatch) {
				//vscode.window.showErrorMessage(`No code block matched the destination regex in file ${file.fsPath}`);
				console.log('No code block matched the destination regex in file', file.fsPath, destinationMatch, destinationRegex, { text });

				continue;
			}
			const destinationPositionStart = document.positionAt(destinationMatch.index);
			const destinationPositionEnd = document.positionAt(destinationMatch.index + destinationMatch[0].length);
			console.log({ destinationMatch }, { destinationPositionStart }, { destinationPositionEnd });
			// Make edits to move the code block
			await editor.edit(editBuilder => {
				// Remove the original code block
				editBuilder.delete(new vscode.Range(codeBlockStart, codeBlockEnd));
				// Insert the code block at the destination line
				editBuilder.insert(destinationPositionEnd, `\n${codeBlock}\n`);
			});
		}

		vscode.window.showInformationMessage("Code blocks moved successfully in all files!");
	});

	// Commands to set source and destination regex patterns
	let setSourceRegexCommand = vscode.commands.registerCommand('codeBlockMover.setSourceRegex', async () => {
		const config = vscode.workspace.getConfiguration('codeBlockMover');
		const sourceRegex = await vscode.window.showInputBox({
			prompt: "Enter the regex to select the code block",
			placeHolder: "(?<=\\/\\* start block \\*\\/)([\\s\\S]*?)(?=\\/\\* end block \\*\\/)"
		});
		if (sourceRegex) {
			await config.update('sourceRegex', sourceRegex, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage("Source regex updated successfully!");
		}
	});

	let setDestinationRegexCommand = vscode.commands.registerCommand('codeBlockMover.setDestinationRegex', async () => {
		const config = vscode.workspace.getConfiguration('codeBlockMover');
		const destinationRegex = await vscode.window.showInputBox({
			prompt: "Enter the regex to find the destination line",
			placeHolder: "insert_here"
		});
		if (destinationRegex) {
			await config.update('destinationRegex', destinationRegex, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage("Destination regex updated successfully!");
		}
	});

	// Register commands
	context.subscriptions.push(moveBlockInFolderCommand);
	context.subscriptions.push(setSourceRegexCommand);
	context.subscriptions.push(setDestinationRegexCommand);
}

export function deactivate() { }

// Helper function to get all files in a directory recursively
function getFilesInDirectory(dirPath: string): vscode.Uri[] {
	let files: vscode.Uri[] = [];

	const items = fs.readdirSync(dirPath);
	for (const item of items) {
		const fullPath = path.join(dirPath, item);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			files = files.concat(getFilesInDirectory(fullPath)); // Recursively get files
		} else if (stat.isFile()) { // Process all files, no filtering
			files.push(vscode.Uri.file(fullPath));
		}
	}

	return files;
}

