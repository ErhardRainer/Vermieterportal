<?php
// Simple data access layer to serve JSON-backed property data
// Later this can be swapped to SQL Server with the same function signature.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Allow CORS for local dev if needed (same-origin won't use it)
if (isset($_SERVER['HTTP_ORIGIN'])) {
  header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
  header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Vary: Origin');
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function getJsonPathByImmoId($immoId) {
  $safeId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$immoId);
  $base = __DIR__ . '/../data';
  $candidates = [
    $base . "/immo_{$safeId}.json",
    $base . "/immo-{$safeId}.json",
    $base . "/{$safeId}.json",
  ];
  foreach ($candidates as $p) {
    if (is_file($p)) return $p;
  }
  return null;
}

function getMessagesPathByImmoId($immoId) {
  $safeId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$immoId);
  $base = __DIR__ . '/../data';
  return $base . "/messages_{$safeId}.json";
}

function readMessages($immoId) {
  $msgPath = getMessagesPathByImmoId($immoId);
  if (is_file($msgPath)) {
    $raw = file_get_contents($msgPath);
    if ($raw !== false && strlen($raw)) {
      $decoded = json_decode($raw, true);
      if (is_array($decoded)) return $decoded;
      if (is_array($decoded['messages'] ?? null)) return $decoded['messages'];
    }
    return [];
  }
  $path = getJsonPathByImmoId($immoId);
  if ($path && is_file($path)) {
    $raw = file_get_contents($path);
    if ($raw !== false) {
      $data = json_decode($raw, true);
      if (isset($data['messages']) && is_array($data['messages'])) return $data['messages'];
    }
  }
  return [];
}

function writeMessages($immoId, $messages) {
  $msgPath = getMessagesPathByImmoId($immoId);
  $dir = dirname($msgPath);
  if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
  $json = json_encode($messages, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error' => 'JSONEncodeError', 'message' => 'Failed to encode messages' ]; }
  $ok = file_put_contents($msgPath, $json);
  if ($ok === false) { http_response_code(500); return [ 'error' => 'WriteError', 'message' => 'Failed to write messages file' ]; }
  return [ 'success' => true ];
}

function getData($immoId, $section = null) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) {
    http_response_code(404);
    return [ 'error' => 'Not Found', 'message' => 'No data file for given immoId', 'immoId' => $immoId ];
  }
  $raw = file_get_contents($path);
  if ($raw === false) {
    http_response_code(500);
    return [ 'error' => 'ReadError', 'message' => 'Failed to read data file' ];
  }
  $data = json_decode($raw, true);
  if ($data === null) {
    http_response_code(500);
    return [ 'error' => 'JSONError', 'message' => 'Invalid JSON in data file' ];
  }
  // Always load messages (possibly from separate file)
  $messages = readMessages($immoId);
  if ($section) {
    if ($section === 'messages') {
      return [ 'immoId' => $immoId, 'section' => 'messages', 'data' => $messages ];
    }
    // support deep dot-path like "costs.years"
    $parts = explode('.', $section);
    $sub = $data;
    foreach ($parts as $p) {
      if (is_array($sub) && array_key_exists($p, $sub)) {
        $sub = $sub[$p];
      } else {
        http_response_code(404);
        return [ 'error' => 'SectionNotFound', 'section' => $section ];
      }
    }
    return [ 'immoId' => $immoId, 'section' => $section, 'data' => $sub ];
  }
  // Inject messages into full payload to keep API shape stable
  $data['messages'] = $messages;
  return $data;
}

function addMessage($immoId, $messageData) {
  $messages = readMessages($immoId);

  $messageId = 'msg' . (time() . rand(1000, 9999));
  $newMessage = [
    'id' => $messageId,
    'date' => date('Y-m-d'),
    'by' => isset($messageData['by']) ? $messageData['by'] : 'Mieter',
    'text' => isset($messageData['text']) ? $messageData['text'] : ''
  ];
  if (isset($messageData['category']) && $messageData['category'] !== '') {
    $newMessage['category'] = $messageData['category'];
  }
  if (isset($messageData['replyTo']) && $messageData['replyTo'] !== '') {
    $newMessage['replyTo'] = $messageData['replyTo'];
  }
  if (isset($messageData['ref']) && $messageData['ref'] !== '') {
    $newMessage['ref'] = $messageData['ref'];
  }

  $messages[] = $newMessage;
  $result = writeMessages($immoId, $messages);
  if (isset($result['error'])) return $result;
  return [ 'success' => true, 'message' => $newMessage ];
}

function updateContact($immoId, $contactType, $contactData) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) {
    http_response_code(404);
    return [ 'error' => 'Not Found', 'message' => 'No data file for given immoId', 'immoId' => $immoId ];
  }
  
  // Read current data
  $raw = file_get_contents($path);
  if ($raw === false) {
    http_response_code(500);
    return [ 'error' => 'ReadError', 'message' => 'Failed to read data file' ];
  }
  
  $data = json_decode($raw, true);
  if ($data === null) {
    http_response_code(500);
    return [ 'error' => 'JSONError', 'message' => 'Invalid JSON in data file' ];
  }
  
  // Validate contact type
  if (!in_array($contactType, ['landlord', 'tenant'])) {
    http_response_code(400);
    return [ 'error' => 'BadRequest', 'message' => 'Invalid contact type. Must be "landlord" or "tenant".' ];
  }
  
  // Ensure contacts structure exists
  if (!isset($data['contacts'])) {
    $data['contacts'] = [];
  }
  if (!isset($data['contacts'][$contactType])) {
    $data['contacts'][$contactType] = [];
  }
  
  // Update contact data (merge with existing)
  $updatedContact = array_merge($data['contacts'][$contactType], $contactData);
  $data['contacts'][$contactType] = $updatedContact;
  
  // Write back to file
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) {
    http_response_code(500);
    return [ 'error' => 'JSONEncodeError', 'message' => 'Failed to encode data' ];
  }
  
  $writeResult = file_put_contents($path, $json);
  if ($writeResult === false) {
    http_response_code(500);
    return [ 'error' => 'WriteError', 'message' => 'Failed to write data file' ];
  }
  
  return [ 'success' => true, 'contact' => $updatedContact ];
}

function addTradesman($immoId, $tData) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) {
    http_response_code(404);
    return [ 'error' => 'Not Found', 'message' => 'No data file for given immoId', 'immoId' => $immoId ];
  }
  $raw = file_get_contents($path);
  if ($raw === false) {
    http_response_code(500);
    return [ 'error' => 'ReadError', 'message' => 'Failed to read data file' ];
  }
  $data = json_decode($raw, true);
  if ($data === null) {
    http_response_code(500);
    return [ 'error' => 'JSONError', 'message' => 'Invalid JSON in data file' ];
  }
  if (!isset($data['tradesmen']) || !is_array($data['tradesmen'])) $data['tradesmen'] = [];
  // generate id
  $id = isset($tData['id']) && $tData['id'] ? $tData['id'] : 't' . (time() . rand(100,999));
  $new = [
    'id' => $id,
    'name' => isset($tData['name']) ? $tData['name'] : '',
    'specialty' => isset($tData['specialty']) ? $tData['specialty'] : '',
    'phone' => isset($tData['phone']) ? $tData['phone'] : '',
    'email' => isset($tData['email']) ? $tData['email'] : '',
    'website' => isset($tData['website']) ? $tData['website'] : '',
    'comment' => isset($tData['comment']) ? $tData['comment'] : '',
    'icon' => isset($tData['icon']) ? $tData['icon'] : 'wrench'
  ];
  $data['tradesmen'][] = $new;
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error'=>'JSONEncodeError' ]; }
  if (file_put_contents($path, $json) === false) { http_response_code(500); return [ 'error'=>'WriteError' ]; }
  return [ 'success' => true, 'tradesman' => $new ];
}

function updateTradesman($immoId, $id, $tData) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) { http_response_code(404); return [ 'error' => 'Not Found' ]; }
  $raw = file_get_contents($path);
  if ($raw === false) { http_response_code(500); return [ 'error' => 'ReadError' ]; }
  $data = json_decode($raw, true);
  if ($data === null) { http_response_code(500); return [ 'error' => 'JSONError' ]; }
  if (!isset($data['tradesmen']) || !is_array($data['tradesmen'])) $data['tradesmen'] = [];
  $found = false;
  foreach ($data['tradesmen'] as $idx => $t) {
    if (isset($t['id']) && $t['id'] == $id) {
      $updated = array_merge($t, $tData);
      $data['tradesmen'][$idx] = $updated;
      $found = true;
      break;
    }
  }
  if (!$found) { http_response_code(404); return [ 'error'=>'NotFound', 'message'=>'Tradesman not found' ]; }
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error'=>'JSONEncodeError' ]; }
  if (file_put_contents($path, $json) === false) { http_response_code(500); return [ 'error'=>'WriteError' ]; }
  return [ 'success' => true, 'tradesman' => $updated ];
}

function updateOverview($immoId, $attributes) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) { http_response_code(404); return [ 'error' => 'Not Found' ]; }
  $raw = file_get_contents($path);
  if ($raw === false) { http_response_code(500); return [ 'error' => 'ReadError' ]; }
  $data = json_decode($raw, true);
  if ($data === null) { http_response_code(500); return [ 'error' => 'JSONError' ]; }
  if (!is_array($attributes)) { http_response_code(400); return [ 'error' => 'BadRequest', 'message' => 'attributes must be array' ]; }
  $data['overview'] = $attributes;
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error'=>'JSONEncodeError' ]; }
  if (file_put_contents($path, $json) === false) { http_response_code(500); return [ 'error'=>'WriteError' ]; }
  return [ 'success' => true, 'overview' => $attributes ];
}

function upsertDescriptionInOverview($immoId, $html) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) { http_response_code(404); return [ 'error' => 'Not Found' ]; }
  $raw = file_get_contents($path);
  if ($raw === false) { http_response_code(500); return [ 'error' => 'ReadError' ]; }
  $data = json_decode($raw, true);
  if ($data === null) { http_response_code(500); return [ 'error' => 'JSONError' ]; }
  if (!isset($data['overview']) || !is_array($data['overview'])) $data['overview'] = [];
  $found = false;
  foreach ($data['overview'] as $idx => $item) {
    if (isset($item['id']) && strtolower($item['id']) === 'description') {
      $data['overview'][$idx]['value'] = $html;
      $found = true;
      break;
    }
  }
  if (!$found) {
    $data['overview'][] = [ 'id' => 'description', 'value' => $html ];
  }
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error'=>'JSONEncodeError' ]; }
  if (file_put_contents($path, $json) === false) { http_response_code(500); return [ 'error'=>'WriteError' ]; }
  return [ 'success' => true ];
}

function uploadApartmentDocument($immoId, $title, $icon, $fileInfo) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) { http_response_code(404); return [ 'error' => 'Not Found' ]; }
  $raw = file_get_contents($path);
  if ($raw === false) { http_response_code(500); return [ 'error' => 'ReadError' ]; }
  $data = json_decode($raw, true);
  if ($data === null) { http_response_code(500); return [ 'error' => 'JSONError' ]; }
  if (!isset($data['documents'])) $data['documents'] = [];
  if (!isset($data['documents']['apartment']) || !is_array($data['documents']['apartment'])) $data['documents']['apartment'] = [];

  // Ensure upload directory exists
  $uploadDir = realpath(__DIR__ . '/../') . DIRECTORY_SEPARATOR . 'uploads';
  if (!is_dir($uploadDir)) { @mkdir($uploadDir, 0777, true); }

  if (!isset($fileInfo['tmp_name']) || !is_uploaded_file($fileInfo['tmp_name'])) {
    http_response_code(400);
    return [ 'error' => 'BadRequest', 'message' => 'No file uploaded' ];
  }
  $origName = $fileInfo['name'];
  $ext = pathinfo($origName, PATHINFO_EXTENSION);
  $docId = 'doc' . (time() . rand(100,999));
  $saveName = $docId . ($ext ? ('.' . $ext) : '');
  $target = $uploadDir . DIRECTORY_SEPARATOR . $saveName;
  if (!move_uploaded_file($fileInfo['tmp_name'], $target)) {
    http_response_code(500);
    return [ 'error' => 'UploadError', 'message' => 'Failed to move uploaded file' ];
  }
  $publicUrl = './uploads/' . $saveName;
  $doc = [
    'id' => $docId,
    'title' => $title ?: $origName,
    'icon' => $icon ?: 'file-text',
    'url' => $publicUrl,
    'uploadedAt' => date('c')
  ];
  $data['documents']['apartment'][] = $doc;
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error'=>'JSONEncodeError' ]; }
  if (file_put_contents($path, $json) === false) { http_response_code(500); return [ 'error'=>'WriteError' ]; }
  return [ 'success' => true, 'document' => $doc ];
}

function softDeleteApartmentDocument($immoId, $identifier) {
  $path = getJsonPathByImmoId($immoId);
  if (!$path) { http_response_code(404); return [ 'error' => 'Not Found' ]; }
  $raw = file_get_contents($path);
  if ($raw === false) { http_response_code(500); return [ 'error' => 'ReadError' ]; }
  $data = json_decode($raw, true);
  if ($data === null) { http_response_code(500); return [ 'error' => 'JSONError' ]; }
  if (!isset($data['documents']['apartment']) || !is_array($data['documents']['apartment'])) {
    http_response_code(404); return [ 'error' => 'NotFound', 'message' => 'No documents section' ];
  }
  $deleted = false;
  foreach ($data['documents']['apartment'] as $idx => $doc) {
    $matches = false;
    if (isset($identifier['id']) && isset($doc['id']) && $identifier['id'] === $doc['id']) $matches = true;
    if (!$matches && isset($identifier['url']) && isset($doc['url']) && $identifier['url'] === $doc['url']) $matches = true;
    if (!$matches && isset($identifier['title']) && isset($doc['title']) && $identifier['title'] === $doc['title']) $matches = true;
    if ($matches) {
      $data['documents']['apartment'][$idx]['deletedAt'] = date('c');
      $deleted = true;
      break;
    }
  }
  if (!$deleted) { http_response_code(404); return [ 'error' => 'NotFound', 'message' => 'Document not found' ]; }
  $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) { http_response_code(500); return [ 'error'=>'JSONEncodeError' ]; }
  if (file_put_contents($path, $json) === false) { http_response_code(500); return [ 'error'=>'WriteError' ]; }
  return [ 'success' => true ];
}

// Handle POST requests (add message, add tradesman, upload document)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // If multipart upload
  if (!empty($_FILES) && isset($_POST['immoId'])) {
    $immoId = $_POST['immoId'];
    $title = isset($_POST['title']) ? $_POST['title'] : '';
    $icon = isset($_POST['icon']) ? $_POST['icon'] : '';
    $fileKey = array_key_first($_FILES);
    $fileInfo = $_FILES[$fileKey];
    $result = uploadApartmentDocument($immoId, $title, $icon, $fileInfo);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }

  $rawInput = file_get_contents('php://input');
  $postData = json_decode($rawInput, true);
  if ($postData === null) {
    http_response_code(400);
    echo json_encode([ 'error' => 'BadRequest', 'message' => 'Invalid JSON in request body' ]);
    exit;
  }
  $immoId = isset($postData['immoId']) ? $postData['immoId'] : '1001';
  if (isset($postData['tradesman'])) {
    $tData = $postData['tradesman'];
    $result = addTradesman($immoId, $tData);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }
  $messageData = isset($postData['message']) ? $postData['message'] : [];
  $result = addMessage($immoId, $messageData);
  echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

// Handle PUT/PATCH requests (update contact, update tradesman, overview/description, soft delete doc)
if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'PATCH') {
  $rawInput = file_get_contents('php://input');
  $putData = json_decode($rawInput, true);
  
  if ($putData === null) {
    http_response_code(400);
    echo json_encode([ 'error' => 'BadRequest', 'message' => 'Invalid JSON in request body' ]);
    exit;
  }
  
  $immoId = isset($putData['immoId']) ? $putData['immoId'] : '1001';
  // Update overview
  if (isset($putData['overviewUpdate']) && isset($putData['overviewUpdate']['attributes'])) {
    $attrs = $putData['overviewUpdate']['attributes'];
    $result = updateOverview($immoId, $attrs);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }
  // Update description (as part of overview)
  if (isset($putData['descriptionHtml'])) {
    $html = $putData['descriptionHtml'];
    $result = upsertDescriptionInOverview($immoId, $html);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }
  // Soft delete apartment doc
  if (isset($putData['deleteDocument'])) {
    $ident = $putData['deleteDocument'];
    $result = softDeleteApartmentDocument($immoId, $ident);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }
  // If updating a tradesman
  if (isset($putData['tradesmanUpdate'])) {
    $tu = $putData['tradesmanUpdate'];
    $tid = isset($tu['id']) ? $tu['id'] : null;
    $tData = isset($tu['data']) ? $tu['data'] : [];
    if (!$tid) { http_response_code(400); echo json_encode([ 'error'=>'BadRequest','message'=>'tradesman id required' ]); exit; }
    $result = updateTradesman($immoId, $tid, $tData);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }
  // Backward-compatible: if tradesman object with id provided
  if (isset($putData['tradesman']) && isset($putData['tradesman']['id'])) {
    $tid = $putData['tradesman']['id'];
    $tData = $putData['tradesman']; unset($tData['id']);
    $result = updateTradesman($immoId, $tid, $tData);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
  }

  $contactType = isset($putData['contactType']) ? $putData['contactType'] : null;
  $contactData = isset($putData['contactData']) ? $putData['contactData'] : [];
  
  if (!$contactType) {
    http_response_code(400);
    echo json_encode([ 'error' => 'BadRequest', 'message' => 'contactType is required' ]);
    exit;
  }
  
  $result = updateContact($immoId, $contactType, $contactData);
  echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

// Handle GET requests (read data)
$immoId = isset($_GET['immoId']) ? $_GET['immoId'] : '1001';
$section = isset($_GET['section']) ? $_GET['section'] : null;

$result = getData($immoId, $section);

echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
