const http = require('http');
const url = require('url');
const mysql = require('mysql2');
require('dotenv').config();
const constants = require('./modules/constants');

const BASE_CONNECTION_STRING = process.env.BASE_CONNECTION_STRING;
const LIMITED_CONNECTION_STRING = process.env.LIMITED_CONNECTION_STRING;

function createConnectionWithPermissions(query) {
  if (query && (query.toUpperCase().startsWith('DELETE') || query.toUpperCase().startsWith('DROP'))) {
      // Create a connection string with limited permissions
      return LIMITED_CONNECTION_STRING;
  } else {
      // Create a connection string with full permissions
      return BASE_CONNECTION_STRING;
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    if (pathname === '/insert') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        let postData;
        try {
          postData = JSON.parse(body);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end(constants.INVALID_JSON_DATA_MESSAGE);
          return;
        }

        const connection = mysql.createConnection(createConnectionWithPermissions(postData.query));
  
        if (Array.isArray(postData)) {
          // If postData is an array, insert multiple patients
          const insertQuery = 'INSERT INTO patients (name, dateOfBirth) VALUES ?';
          const values = postData.map(patient => [patient.name, patient.dateOfBirth]);
          connection.query(insertQuery, [values], (err, result) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end(constants.INSERT_ERROR_MESSAGE);
            } else {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(constants.INSERT_SUCCESS_MESSAGE);
            }
          });
        } else {
          const insertQuery = decodeURIComponent(postData.query);
          console.log(insertQuery);
          connection.query(insertQuery, (err, result) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end(JSON.stringify({ error: constants.INSERT_ERROR_MESSAGE }));
            } else {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(JSON.stringify({ message: constants.INSERT_SUCCESS_MESSAGE }));
            }
          });
        }
      });
    }
  } else if (req.method === 'GET') {
    if (pathname === '/query') {
      const query = parsedUrl.query.query;
      const connection = mysql.createConnection(createConnectionWithPermissions(query));
      if(!isSelectQuery(query)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(constants.SELECT_ONLY_ERROR_MESSAGE);
        return;
      }

      connection.query(query, (err, result) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(constants.EXECUTE_ERROR_MESSAGE);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
      });
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(constants.NOT_FOUND_MESSAGE);
  }
});

// Function to check if the query is a SELECT query
function isSelectQuery(query) {
  return query.trim().substring(0, 6).toUpperCase() === 'SELECT';
}

// Listen on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
