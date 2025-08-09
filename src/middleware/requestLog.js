const requestLogger = (req, res, next) => {
  const start = Date.now();

  const { method, originalUrl, body, headers, ip } = req;
  const userAgent = headers["user-agent"];

  console.log(`--- Incoming Request ---
    Method: ${method}
    Route: ${originalUrl}
    Body: ${JSON.stringify(body)}
    IP: ${ip}
    Browser: ${userAgent}
    -------------------------`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `Response Status: ${res.statusCode} | Duration: ${duration}ms\n`
    );
  });

  next();
};

export default requestLogger;
