const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Setup SQLite3
const db = new sqlite3.Database('./files.db');

// Function to ensure the table schema is correct
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, path TEXT, size INTEGER, upload_date TEXT, extension TEXT)", (err) => {
        if (err) {
            console.error('Failed to create table:', err);
        } else {
            console.log('Table created successfully');
        }
    });
});

// Setup file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const fileName = crypto.randomBytes(16).toString('hex') + fileExtension;
        cb(null, fileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 80 * 1024 * 1024 } // 80MB limit
});

app.use(express.static('public'));
app.use(express.static('uploads'));

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const fileId = req.file.filename.split('.')[0];
    const fileName = req.body.fileName || req.file.originalname;
    const filePath = path.join('uploads', req.file.filename);
    const fileSize = req.file.size;
    const uploadDate = new Date().toISOString();
    const fileExtension = path.extname(req.file.filename).toLowerCase();

    db.run("INSERT INTO files (id, name, path, size, upload_date, extension) VALUES (?, ?, ?, ?, ?, ?)", [fileId, fileName, filePath, fileSize, uploadDate, fileExtension], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }
        res.json({ url: `http://localhost:${port}/file/${fileId}` });
    });
});

app.get('/files/:id', (req, res) => {
    const fileId = req.params.id;
    db.get("SELECT * FROM files WHERE id = ?", [fileId], (err, row) => {
        if (err || !row) {
            return res.status(404).send('File not found');
        }
        res.sendFile(path.resolve(row.path));
    });
});

// Helper function to determine file type
function getFileType(extension) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    const fontExtensions = ['.woff2', '.woff', '.otf', '.ttf', '.eot'];
    if (imageExtensions.includes(extension)) return 'Image';
    if (documentExtensions.includes(extension)) return 'Document';
    if (fontExtensions.includes(extension)) return 'Font';
    return 'Undetermined';
}

// File details page
app.get('/file/:id', (req, res) => {
    const fileId = req.params.id;
    db.get("SELECT * FROM files WHERE id = ?", [fileId], (err, row) => {
        if (err || !row) {
            return res.status(404).send('File not found');
        }
        const fileExtension = row.extension;
        const fileType = getFileType(fileExtension);
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>File Details</title>
                <style>
                    body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #150a2b;
                        color: white;
                        font-family: 'Lexend', sans-serif;
                        text-align: center;
                    }
                    #file-details {
                        background-color: #180c2d;
                        padding: 20px;
                        border: 1px solid #322845;
                        border-radius: 18px;
                        box-shadow: 0 2px 8px rgb(42, 26, 56, 0.1);
                        max-width: 600px;
                        width: 100%;
                        margin-top: 100px;
                        margin-bottom: 100px;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                    button {
                        padding: 10px;
                        border: none;
                        border-radius: 8px;
                        background-color: #6f1ba7;
                        color: white;
                        cursor: pointer;
                        font-family: 'Roboto Slab', sans-serif;
                        font-size: 18px;
                        margin-top: 20px;
                    }
                    button:hover {
                        background-color: #8a2ccf;
                    }
                    .file-info {
                        margin-bottom: 20px;
                    }
                    .file-info p {
                        margin: 5px 0;
                    }
                </style>
            </head>
            <body>
                <div id="file-details">
                    <h1>File Details</h1>
                    <div class="file-info">
                        <p><strong>Name:</strong> ${row.name}</p>
                        <p><strong>Size:</strong> ${Math.round(row.size / 1024)} KB</p>
                        <p><strong>Upload Date:</strong> ${new Date(row.upload_date).toLocaleDateString()}</p>
                        <p><strong>File Extension:</strong> ${fileExtension}</p>
                        <p><strong>File Type:</strong> ${fileType}</p>
                    </div>
                    ${['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension) ? `<img src="/files/${fileId}" alt="File Preview"/>` : ''}
                    <br>
                    <a href="/files/${fileId}" download>
                        <button>Download File</button>
                    </a>
                </div>
            </body>
            </html>
        `);
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
