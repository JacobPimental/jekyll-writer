// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as YAML from 'yaml';
import { execFile } from 'child_process';
import { stderr, stdout } from 'process';
import { join, resolve } from 'path';
import { rejects } from 'assert';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.commands.registerCommand("jekyll-helper.new-post", () => {
			NewPost();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("jekyll-helper.paste-image", () => {
			pasteImage();
		})
	);
	/*let disposable = vscode.commands.registerCommand('jekyll-writer.createpost', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Jekyll Writer!');
	});

	context.subscriptions.push(disposable);*/
}


// Pastes Image
async function pasteImage() {
	console.log(process.platform);
	switch(process.platform) {
		case "linux": {
			await pasteImageLinux();
			break;
		}
		case "win32": {
			vscode.window.showInformationMessage("Windows support not available yet");
		}
	}
}

//Pastes Image for Linux
async function pasteImageLinux() {
	// Get image title
	var imageTitle = await vscode.window.showInputBox({'prompt': 'Image Title'});
	if (imageTitle === undefined){
		return;
	}

	// Get Image Size
	var [status, stdout] = await runScript(__dirname + '/../scripts/linux/get-image-size.sh');
	if(status === 1 || stdout === "") {			
		vscode.window.showErrorMessage("Error parsing clipboard. Are you pasting an image?");
		return;
	}
	const imageSize = stdout;

	// Image size selector
	const imageSizeOptions = getImageSizeOptions(imageSize);
	var chosenImageSize = await quickPickSelection(imageSizeOptions);
	const preserveAspectRatio = vscode.workspace.getConfiguration('jekyll-helper.paste-image').get('preserveAspectRatio');
	if(chosenImageSize === ""){
		vscode.window.showErrorMessage("Please input Image Size");
	}
	if(!preserveAspectRatio){
		chosenImageSize += '!';
	}

	// Create image path
	var imageDirectory = vscode.workspace.getConfiguration('jekyll-helper.paste-image').get('imageDirectory');
	const wsPath = getActiveWorkspaceFolder();
	if (wsPath === undefined){
		vscode.window.showErrorMessage("Must be in an active workspace!");
		return;
	}

	const parsedPath = parseImagePath(wsPath.uri.fsPath + '/' + imageDirectory);
	if(parsedPath === null){
		vscode.window.showErrorMessage('Something went wrong parsing frontmatter');
	}
	const imagePath = parsedPath + '/' + slugify(imageTitle) + '.png';
	[status, stdout] = await runScript(__dirname + '/../scripts/linux/paste-image.sh', [imagePath, chosenImageSize]);
	if(status === 1) {			
		vscode.window.showErrorMessage("Error parsing clipboard. Are you pasting an image?");
		return;
	}

	// Add markdown text
	const editor = vscode.window.activeTextEditor;
	if(typeof(imageDirectory) !== "string"){
		vscode.window.showErrorMessage("We should not get here!!!!");
		return;
	}
	var localPath = parseImagePath(imageDirectory) + '/' + slugify(imageTitle) + '.png';
	const snippetString = new vscode.SnippetString("![");
	snippetString.appendPlaceholder("alt");
	snippetString.appendText(`](${localPath})`);
	editor?.insertSnippet(snippetString);
}

// QuickPick helper function
function quickPickSelection(options: any[]){
	return new Promise<string>((resolve) => {
		var selectedItem = "";
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = options.map((label) => ({label}));
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.onDidChangeSelection(selection => {
			if(selection[0]) {
				selectedItem = selection[0].label;
				return;
			}
		});
		quickPick.onDidAccept(() => {
			quickPick.dispose();
			resolve(selectedItem);
		});
		quickPick.placeholder = "Image Size";
		quickPick.show();
	});
}

// Gets different image sizes
function getImageSizeOptions(originalSize: string){
	var [origW, origH] = originalSize.split('x');
	var origWNum = +origW;
	var origHNum = +origH;
	const options = [originalSize,
					 [Math.floor(origWNum / 2), Math.floor(origHNum / 2)].join("x"),
					 [Math.floor(origWNum / 3), Math.floor(origHNum / 3)].join("x"),
					 [Math.floor(origWNum / 4), Math.floor(origHNum / 4)].join("x")];
	return options;

}

// Runs shell script
function runScript(scriptFilePath: string, args: any[] = []): Promise<[any, any]> {
	return new Promise((resolve) => {
		var stdout = "";
		var statusCode;
		const status = execFile(scriptFilePath, args, (error: any, stdout: any, stderr: any) => {
			if(error) {
				console.error(`ERROR: ${error}`);
				return;
			}
			if(stderr) {
				console.error(`STDERR: ${stderr}`);
				return;			
			}
			return stdout;
		});
		status.stdout?.on("data", (data) => {
			stdout += data;
		});
		status.on("exit", (code) => {
			resolve([code, stdout]);
		});
	});
}

// Parse Image Directory
function parseImagePath(imagePath: string){
	if(imagePath.includes('{slug}')){
		var frontmatter = readFrontMatter();
		if(frontmatter === null){
			return null;
		}
		if(!frontmatter.hasOwnProperty('title')){
			return null;
		}
		var title = frontmatter.title;
		imagePath = imagePath.replace('{slug}', slugify(title));
		return imagePath;
	}
	return imagePath;
}

// Gets frontmatter info as object
function readFrontMatter(){
	const editor = vscode.window.activeTextEditor;
	if(editor) {
		const documentText = editor.document.getText();
		const documentLines = documentText.split('\n');
		var frontmatterLines = Array();
		var gotFrontMatter = false;
		for(var i=1; i<documentLines.length; i++){
			if(documentLines[i].startsWith('----')){
				gotFrontMatter = true;
				break;
			}
			frontmatterLines.push(documentLines[i]);
		}
		if(!gotFrontMatter){
			return null;
		}
		var frontmatter = frontmatterLines.join('\n');
		var yamlData = YAML.parse(frontmatter);
		return yamlData;
	}
	return null;
}



// Creates new post
async function NewPost() {
	// Get Post Title
	var title = await vscode.window.showInputBox({ 'prompt': 'Title of Post' });
	if (title === undefined) {
		return;
	}

	// Get Post Date
	var curDate = new Date();
	var curDateStr = `${curDate.getFullYear()}-${curDate.getMonth() + 1}-${curDate.getDate()}`;
	var date = await vscode.window.showInputBox({ 'prompt': 'Date of Post',
												  'value': curDateStr });
	if (date === undefined) {
		return;
	}

	// Get Post Permalink
	var permalink = await vscode.window.showInputBox({ 'prompt': 'Permalink',
													   'value': parsePermalinkConfig(title) });
	if (permalink === undefined) {
		return;
	}
	permalink = permalink.replaceAll('{slug}', slugify(title));

	// Create Post File
	const wsEdit = new vscode.WorkspaceEdit();
	const wsPath = getActiveWorkspaceFolder();
	if (wsPath === undefined) {
		vscode.window.showErrorMessage("Must be in an active workspace!");
	}
	else {
		// Get Config Information
		var postPath = vscode.workspace.getConfiguration("jekyll-helper.new-post").get('location');
		var prependDate = vscode.workspace.getConfiguration("jekyll-helper.new-post").get('prependDate');

		// Create file
		var fileName = slugify(title);
		var filePath = vscode.Uri.file(wsPath.uri.fsPath + '/' + postPath + ((prependDate === true) ? (date + '-') : '') + fileName + '.md');
		wsEdit.createFile(filePath, { ignoreIfExists: true });
		
		// Set frontmatter data
		var frontmatterData = getYAMLData();
		frontmatterData['title'] = title;
		frontmatterData['permalink'] = permalink;
		frontmatterData['date'] = date;

		// Create frontmatter text
		var padding = "---";
		var frontmatterText = `${padding}\n${YAML.stringify(frontmatterData)}${padding}`;

		// Insert frontmatter into file
		wsEdit.insert(filePath, new vscode.Position(0, 0), frontmatterText);
		vscode.workspace.applyEdit(wsEdit);
	}
}

// Creates permalink from config
function parsePermalinkConfig(title: string) {
	var permalink = vscode.workspace.getConfiguration("jekyll-helper.new-post").get('permalink') as string;
	return permalink.replaceAll("{slug}", slugify(title));
}

// Gets frontmatter data from config
function getYAMLData() {
	var frontmatterConfig = vscode.workspace.getConfiguration("jekyll-helper.new-post").get('frontmatter') as string;
	var yamlData = YAML.parse(frontmatterConfig);
	return yamlData;
}

// Gets the current active workspace folder
function getActiveWorkspaceFolder() {
	if (vscode.window.activeTextEditor) {
		const activeEditor = vscode.window.activeTextEditor.document.uri;
		return vscode.workspace.getWorkspaceFolder(activeEditor);
	}
	return undefined;
}

// Slugifies a string for URLs
function slugify(str: string) {
	str = str.replace(/^\s+|\s+$/g, '');

	// Make the string lowercase
	str = str.toLowerCase();

	// Remove accents, swap ñ for n, etc
	var from = "ÁÄÂÀÃÅČÇĆĎÉĚËÈÊẼĔȆÍÌÎÏŇÑÓÖÒÔÕØŘŔŠŤÚŮÜÙÛÝŸŽáäâàãåčçćďéěëèêẽĕȇíìîïňñóöòôõøðřŕšťúůüùûýÿžþÞĐđßÆa·/_,:;";
	var to = "AAAAAACCCDEEEEEEEEIIIINNOOOOOORRSTUUUUUYYZaaaaaacccdeeeeeeeeiiiinnooooooorrstuuuuuyyzbBDdBAa------";
	for (var i = 0, l = from.length; i < l; i++) {
		str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
	}

	// Remove invalid chars
	str = str.replace(/[^a-z0-9 -]/g, '')
		// Collapse whitespace and replace by -
		.replace(/\s+/g, '-')
		// Collapse dashes
		.replace(/-+/g, '-');

	return str;
}

// this method is called when your extension is deactivated
export function deactivate() { }
