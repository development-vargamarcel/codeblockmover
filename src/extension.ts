import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
		const defaultSourceRegex = config.get<string>('sourceRegex') || '';
		const defaultDestinationRegex = config.get<string>('destinationRegex') || '';

		// Prompt for source regex, default to configuration if available
		const sourceRegexPattern = await vscode.window.showInputBox({
			prompt: 'Enter the regex to select the code block',
			value: defaultSourceRegex,
		});
		if (!sourceRegexPattern) {
			vscode.window.showErrorMessage("Source regex pattern is required");
			return;
		}

		// Prompt for destination regex, default to configuration if available
		const destinationRegexPattern = await vscode.window.showInputBox({
			prompt: 'Enter the regex to find the destination line',
			value: defaultDestinationRegex,
		});
		if (!destinationRegexPattern) {
			vscode.window.showErrorMessage("Destination regex pattern is required");
			return;
		}

		// Compile the regular expressions
		const sourceRegex = new RegExp(sourceRegexPattern, 'gm');
		const destinationRegex = new RegExp(destinationRegexPattern, 'gm');

		// Read all files in the selected folder
		const files = getFilesInDirectory(folderPath);
		if (files.length === 0) {
			vscode.window.showErrorMessage("No files found in the selected folder.");
			return;
		}

		// Process each file in the folder
		for (const file of files) {
			const document = await vscode.workspace.openTextDocument(file);
			const editor = await vscode.window.showTextDocument(document);

			const text = document.getText();

			// Find the code block
			const sourceMatch = sourceRegex.exec(text);
			if (!sourceMatch) {
				vscode.window.showErrorMessage(`No code block matched the source regex in file ${file.fsPath} ${sourceMatch} ${sourceRegex}`);
				continue;
			}
			const codeBlock = sourceMatch[0];
			const codeBlockStart = document.positionAt(sourceMatch.index);
			const codeBlockEnd = document.positionAt(sourceMatch.index + codeBlock.length);

			// Find the destination line
			const destinationMatch = destinationRegex.exec(text);
			if (!destinationMatch) {
				vscode.window.showErrorMessage(`No line matched the destination regex in file ${file.fsPath}`);
				continue;
			}
			const destinationPosition = document.positionAt(destinationMatch.index);

			// Make edits to move the code block
			await editor.edit(editBuilder => {
				// Remove the original code block
				editBuilder.delete(new vscode.Range(codeBlockStart, codeBlockEnd));
				// Insert the code block at the destination line
				editBuilder.insert(destinationPosition, `\n${codeBlock}\n`);
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

