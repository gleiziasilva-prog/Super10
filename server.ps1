$ErrorActionPreference = "Stop"

$webRoot = Join-Path $PSScriptRoot "super10"
$databaseDirectory = Join-Path $PSScriptRoot "data"
$databasePath = Join-Path $databaseDirectory "super10.db"
$seedPath = Join-Path $webRoot "products.json"
$baseAddress = "http://127.0.0.1:8080/"
$allowedCategories = @(
    "Maquiagem",
    "Skincare",
    "Cozinha",
    "Potes plásticos",
    "Brinquedos e jogos",
    "Utilidades domésticas",
    "Novidades"
)

if (-not (Test-Path $webRoot -PathType Container)) {
    throw "Pasta do site não encontrada: $webRoot"
}
if (-not (Test-Path $seedPath -PathType Leaf)) {
    throw "Arquivo inicial do catálogo não encontrado: $seedPath"
}

$null = New-Item -ItemType Directory -Path $databaseDirectory -Force

$sqliteSource = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class Super10Sqlite : IDisposable
{
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate int RowCallback(IntPtr context, int columnCount, IntPtr values, IntPtr names);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_open(IntPtr fileName, out IntPtr database);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_exec(IntPtr database, IntPtr sql, RowCallback callback, IntPtr context, out IntPtr errorMessage);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern void sqlite3_free(IntPtr memory);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int sqlite3_close(IntPtr database);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sqlite3_errmsg(IntPtr database);

    private readonly IntPtr database;
    private bool disposed;

    public Super10Sqlite(string path)
    {
        IntPtr fileName = AllocateUtf8(path);
        try
        {
            int result = sqlite3_open(fileName, out database);
            if (result != 0)
            {
                throw new InvalidOperationException("Não foi possível abrir o banco SQLite: " + ReadUtf8(sqlite3_errmsg(database)));
            }
        }
        finally
        {
            Marshal.FreeHGlobal(fileName);
        }

        Execute("PRAGMA journal_mode=DELETE;");
        Execute("PRAGMA busy_timeout=5000;");
        Execute(
            "CREATE TABLE IF NOT EXISTS products (" +
            "id TEXT PRIMARY KEY NOT NULL," +
            "name TEXT NOT NULL," +
            "category TEXT NOT NULL," +
            "description TEXT NOT NULL," +
            "image TEXT NOT NULL," +
            "stock INTEGER NOT NULL CHECK (stock >= 0)," +
            "is_new INTEGER NOT NULL DEFAULT 0," +
            "price_cents INTEGER NOT NULL DEFAULT 1000 CHECK (price_cents = 1000)," +
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP" +
            ");"
        );
        Execute("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
    }

    public int CountProducts()
    {
        List<Dictionary<string, object>> rows = Query("SELECT COUNT(*) AS count FROM products;");
        return Convert.ToInt32(rows[0]["count"]);
    }

    public bool HasSeededCatalog()
    {
        List<Dictionary<string, object>> rows = Query("SELECT value FROM app_meta WHERE key='catalog_seeded';");
        return rows.Count > 0 && Convert.ToString(rows[0]["value"]) == "1";
    }

    public void MarkCatalogSeeded()
    {
        Execute("INSERT INTO app_meta (key, value) VALUES ('catalog_seeded', '1') ON CONFLICT(key) DO UPDATE SET value='1';");
    }

    public List<Dictionary<string, object>> GetProducts()
    {
        return Query(
            "SELECT id, name, category, description, image, stock, is_new AS isNew, price_cents AS priceCents " +
            "FROM products ORDER BY created_at ASC, id ASC;"
        );
    }

    public void SaveProduct(string id, string name, string category, string description, string image, int stock, bool isNew)
    {
        string sql =
            "INSERT INTO products (id, name, category, description, image, stock, is_new) VALUES (" +
            Quote(id) + "," + Quote(name) + "," + Quote(category) + "," + Quote(description) + "," + Quote(image) + "," +
            stock.ToString(System.Globalization.CultureInfo.InvariantCulture) + "," + (isNew ? "1" : "0") + ") " +
            "ON CONFLICT(id) DO UPDATE SET " +
            "name=excluded.name, category=excluded.category, description=excluded.description, image=excluded.image, " +
            "stock=excluded.stock, is_new=excluded.is_new, updated_at=CURRENT_TIMESTAMP;";
        Execute(sql);
    }

    public void DeleteProduct(string id)
    {
        Execute("DELETE FROM products WHERE id=" + Quote(id) + ";");
    }

    private List<Dictionary<string, object>> Query(string sql)
    {
        List<Dictionary<string, object>> rows = new List<Dictionary<string, object>>();
        RowCallback callback = delegate(IntPtr context, int columnCount, IntPtr values, IntPtr names)
        {
            Dictionary<string, object> row = new Dictionary<string, object>(StringComparer.Ordinal);
            for (int index = 0; index < columnCount; index++)
            {
                IntPtr namePointer = Marshal.ReadIntPtr(names, index * IntPtr.Size);
                IntPtr valuePointer = Marshal.ReadIntPtr(values, index * IntPtr.Size);
                string columnName = ReadUtf8(namePointer);
                string value = ReadUtf8(valuePointer);
                object parsedValue;
                if (columnName == "isNew")
                {
                    parsedValue = value == "1";
                }
                else if (columnName == "stock" || columnName == "priceCents" || columnName == "count")
                {
                    parsedValue = Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture);
                }
                else
                {
                    parsedValue = value;
                }
                row[columnName] = parsedValue;
            }
            rows.Add(row);
            return 0;
        };

        IntPtr sqlPointer = AllocateUtf8(sql);
        IntPtr errorMessage;
        try
        {
            int result = sqlite3_exec(database, sqlPointer, callback, IntPtr.Zero, out errorMessage);
            if (result != 0)
            {
                string message = ReadUtf8(errorMessage);
                if (errorMessage != IntPtr.Zero) sqlite3_free(errorMessage);
                throw new InvalidOperationException("Erro na consulta SQLite: " + message);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(sqlPointer);
            GC.KeepAlive(callback);
        }
        return rows;
    }

    private void Execute(string sql)
    {
        IntPtr sqlPointer = AllocateUtf8(sql);
        IntPtr errorMessage;
        try
        {
            int result = sqlite3_exec(database, sqlPointer, null, IntPtr.Zero, out errorMessage);
            if (result != 0)
            {
                string message = ReadUtf8(errorMessage);
                if (errorMessage != IntPtr.Zero) sqlite3_free(errorMessage);
                throw new InvalidOperationException("Erro na gravação SQLite: " + message);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(sqlPointer);
        }
    }

    private static string Quote(string value)
    {
        return "'" + value.Replace("'", "''") + "'";
    }

    private static IntPtr AllocateUtf8(string value)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(value + "\0");
        IntPtr memory = Marshal.AllocHGlobal(bytes.Length);
        Marshal.Copy(bytes, 0, memory, bytes.Length);
        return memory;
    }

    private static string ReadUtf8(IntPtr value)
    {
        if (value == IntPtr.Zero) return null;
        List<byte> bytes = new List<byte>();
        int offset = 0;
        byte current;
        while ((current = Marshal.ReadByte(value, offset++)) != 0)
        {
            bytes.Add(current);
        }
        return Encoding.UTF8.GetString(bytes.ToArray());
    }

    public void Dispose()
    {
        if (!disposed)
        {
            sqlite3_close(database);
            disposed = true;
        }
    }
}
'@

Add-Type -TypeDefinition $sqliteSource -ErrorAction Stop
$database = New-Object Super10Sqlite($databasePath)

if (-not $database.HasSeededCatalog()) {
    if ($database.CountProducts() -eq 0) {
        $seedProducts = ConvertFrom-Json -InputObject (Get-Content -Raw -Encoding UTF8 $seedPath)
        foreach ($product in $seedProducts) {
            $database.SaveProduct(
                [string]$product.id,
                [string]$product.name,
                [string]$product.category,
                [string]$product.description,
                [string]$product.image,
                [int]$product.stock,
                [bool]$product.isNew
            )
        }
    }
    $database.MarkCatalogSeeded()
}

function Send-JsonResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [object]$Data
    )
    $json = ConvertTo-Json -InputObject $Data -Depth 8 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Read-ProductBody {
    param([System.Net.HttpListenerRequest]$Request)

    if ($Request.ContentLength64 -gt 32768) {
        throw "O cadastro excede o tamanho permitido."
    }
    $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
    try {
        $body = $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }
    if ([string]::IsNullOrWhiteSpace($body)) {
        throw "Envie os dados do produto em formato JSON."
    }
    return ($body | ConvertFrom-Json -ErrorAction Stop)
}

function Get-ValidatedProduct {
    param(
        [object]$Body,
        [string]$ProductId
    )

    foreach ($field in @("name", "category", "description", "image", "stock")) {
        if ($null -eq $Body.$field) {
            throw "O campo '$field' é obrigatório."
        }
    }
    $name = ([string]$Body.name).Trim()
    $category = ([string]$Body.category).Trim()
    $description = ([string]$Body.description).Trim()
    $image = ([string]$Body.image).Trim()
    if ($name.Length -lt 1 -or $name.Length -gt 70) {
        throw "O nome precisa ter entre 1 e 70 caracteres."
    }
    if ($description.Length -lt 1 -or $description.Length -gt 120) {
        throw "A descrição precisa ter entre 1 e 120 caracteres."
    }
    if ($allowedCategories -notcontains $category) {
        throw "Selecione uma categoria válida."
    }
    $imageUri = $null
    if (-not [Uri]::TryCreate($image, [UriKind]::Absolute, [ref]$imageUri) -or $imageUri.Scheme -notin @("http", "https")) {
        throw "Informe uma URL de imagem HTTP ou HTTPS válida."
    }
    $stock = 0
    if (-not [int]::TryParse([string]$Body.stock, [ref]$stock) -or $stock -lt 0 -or $stock -gt 1000000) {
        throw "O estoque deve ser um número inteiro entre 0 e 1.000.000."
    }
    if ($ProductId -and $ProductId -notmatch '^[A-Za-z0-9_-]{1,80}$') {
        throw "Identificador de produto inválido."
    }

    return @{
        id = $ProductId
        name = $name
        category = $category
        description = $description
        image = $imageUri.AbsoluteUri
        stock = $stock
        isNew = [bool]$Body.isNew
    }
}

function Send-StaticFile {
    param(
        [System.Net.HttpListenerContext]$Context,
        [string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        $RelativePath = "index.html"
    }
    $decodedPath = [Uri]::UnescapeDataString($RelativePath).Replace("/", "\")
    $filePath = [System.IO.Path]::GetFullPath((Join-Path $webRoot $decodedPath))
    $rootPrefix = [System.IO.Path]::GetFullPath($webRoot).TrimEnd("\") + "\"
    if (-not $filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $filePath -PathType Leaf)) {
        Send-JsonResponse $Context.Response 404 @{ error = "Arquivo não encontrado." }
        return
    }

    $extensions = @{
        ".html" = "text/html; charset=utf-8"
        ".css" = "text/css; charset=utf-8"
        ".js" = "text/javascript; charset=utf-8"
        ".json" = "application/json; charset=utf-8"
        ".png" = "image/png"
        ".jpg" = "image/jpeg"
        ".jpeg" = "image/jpeg"
        ".svg" = "image/svg+xml"
        ".ico" = "image/x-icon"
    }
    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    if (-not $extensions.ContainsKey($extension)) {
        Send-JsonResponse $Context.Response 404 @{ error = "Tipo de arquivo não permitido." }
        return
    }

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $Context.Response.StatusCode = 200
    $Context.Response.ContentType = $extensions[$extension]
    $Context.Response.ContentLength64 = $bytes.Length
    if ($Context.Request.HttpMethod -eq "HEAD") {
        $Context.Response.Close()
        return
    }
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($baseAddress)
$listener.Start()
Write-Host "Super10 disponível em $baseAddress" -ForegroundColor Cyan
Write-Host "Banco SQLite: $databasePath" -ForegroundColor DarkGray
Write-Host "Somente esta máquina pode acessar a API. Pressione Ctrl+C para encerrar." -ForegroundColor DarkGray

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response
            $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)

            if ($path -eq "/api/products") {
                if ($request.HttpMethod -eq "GET") {
                    Send-JsonResponse $response 200 $database.GetProducts()
                }
                elseif ($request.HttpMethod -eq "POST") {
                    $body = Read-ProductBody $request
                    $product = Get-ValidatedProduct $body ""
                    $product.id = [Guid]::NewGuid().ToString("N")
                    $database.SaveProduct($product.id, $product.name, $product.category, $product.description, $product.image, $product.stock, $product.isNew)
                    Send-JsonResponse $response 201 $product
                }
                else {
                    Send-JsonResponse $response 405 @{ error = "Método não permitido." }
                }
                continue
            }

            if ($path -match '^/api/products/([^/]+)$') {
                $productId = $Matches[1]
                if ($request.HttpMethod -eq "PUT") {
                    $body = Read-ProductBody $request
                    $product = Get-ValidatedProduct $body $productId
                    $exists = @($database.GetProducts() | Where-Object { $_.id -eq $productId }).Count -gt 0
                    if (-not $exists) {
                        Send-JsonResponse $response 404 @{ error = "Produto não encontrado." }
                    }
                    else {
                        $database.SaveProduct($product.id, $product.name, $product.category, $product.description, $product.image, $product.stock, $product.isNew)
                        Send-JsonResponse $response 200 $product
                    }
                }
                elseif ($request.HttpMethod -eq "DELETE") {
                    $exists = @($database.GetProducts() | Where-Object { $_.id -eq $productId }).Count -gt 0
                    if (-not $exists) {
                        Send-JsonResponse $response 404 @{ error = "Produto não encontrado." }
                    }
                    else {
                        $database.DeleteProduct($productId)
                        Send-JsonResponse $response 200 @{ deleted = $true }
                    }
                }
                else {
                    Send-JsonResponse $response 405 @{ error = "Método não permitido." }
                }
                continue
            }

            if ($request.HttpMethod -ne "GET" -and $request.HttpMethod -ne "HEAD") {
                Send-JsonResponse $response 405 @{ error = "Método não permitido." }
                continue
            }
            $relativePath = $path.TrimStart("/")
            Send-StaticFile $context $relativePath
        }
        catch {
            $message = $_.Exception.Message
            $status = 400
            if ($message -like "Erro na *SQLite:*" -or $message -like "Não foi possível abrir o banco*") {
                $status = 500
                Write-Error $_
            }
            if (-not $context.Response.OutputStream.CanWrite) {
                continue
            }
            try {
                Send-JsonResponse $context.Response $status @{ error = $message }
            }
            catch {
                Write-Error $_
            }
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
    $database.Dispose()
}
