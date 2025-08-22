// LAIKA Architecture Visualization - Comprehensive Service Monitoring
(function() {
  // Complete list of all LAIKA services
  const SERVICES = [
    // Core AI Services
    { id: 'stt', label: 'STT', url: 'stt', group: 'ai', level: 0, description: 'Speech-to-Text Service', port: 8766 },
    { id: 'llm', label: 'LLM', url: 'llm', group: 'ai', level: 1, description: 'Large Language Model Service', port: 8766 },
    { id: 'tts', label: 'TTS', url: 'tts', group: 'ai', level: 2, description: 'Text-to-Speech Service', port: 8766 },
    { id: 'aud', label: 'AUD', url: 'aud', group: 'ai', level: 1, description: 'Audio Detection Service', port: 8766 },
    
    // Robot Control Services
    { id: 'act', label: 'ACT', url: 'control', group: 'robot', level: 2, description: 'Action Control Service', port: 8766 },
    { id: 'sen', label: 'SEN', url: 'sensor', group: 'robot', level: 0, description: 'Sensor Data Service', port: 8766 },
    { id: 'cam', label: 'CAM', url: 'camera', group: 'robot', level: 0, description: 'Camera Service', port: 8766 },
    
    // Infrastructure Services
    { id: 'pubsub', label: 'PubSub', url: 'pubsub', group: 'infra', level: 0, description: 'Message Broker Service', port: 8766 },
    { id: 'mem', label: 'MEM', url: 'mem', group: 'infra', level: 1, description: 'Memory Service', port: 8766 },
    
    // External Systems
    { id: 'ros2', label: 'ROS2', url: 'slam', group: 'external', level: 1, description: 'ROS2 Bridge', port: 9090 },
    { id: 'bvh', label: 'BVH', url: 'behavior', group: 'external', level: 1, description: 'Behavior Tree Service', port: 8766 }
  ];
  
  // Service connections and message flow
  const EDGES = [
    // Speech processing pipeline
    { from: 'stt', to: 'llm', topic: '/stt/transcript', description: 'Speech transcript' },
    { from: 'llm', to: 'tts', topic: '/llm/response', description: 'AI response' },
    { from: 'llm', to: 'act', topic: '/llm/act', description: 'Action commands' },
    
    // Sensor data flow
    { from: 'sen', to: 'llm', topic: '/sensor/data', description: 'Sensor readings' },
    { from: 'sen', to: 'bvh', topic: '/sensor/state', description: 'Environment state' },
    { from: 'cam', to: 'llm', topic: '/camera/frame', description: 'Visual data' },
    { from: 'cam', to: 'aud', topic: '/camera/audio', description: 'Audio stream' },
    
    // Memory and context
    { from: 'mem', to: 'llm', topic: '/memory/context', description: 'Context retrieval' },
    { from: 'llm', to: 'mem', topic: '/llm/memory', description: 'Memory storage' },
    
    // Robot control
    { from: 'act', to: 'ros2', topic: '/act/command', description: 'Robot commands' },
    { from: 'ros2', to: 'sen', topic: '/ros2/feedback', description: 'Robot feedback' },
    { from: 'bvh', to: 'llm', topic: '/behavior/state', description: 'Behavior state' },
    
    // Audio processing
    { from: 'aud', to: 'llm', topic: '/aud/detection', description: 'Audio events' },
    { from: 'stt', to: 'aud', topic: '/stt/audio', description: 'Audio input' }
  ];

  // Service status tracking
  let serviceStatus = {};
  let messageCount = 0;
  let lastMessageTime = Date.now();
  let startTime = Date.now();
  let logPaused = false;
  const maxLogEntries = 100;

  const container = document.getElementById('network');
  
  // Create nodes with hierarchical positioning and service-specific styling
  const nodes = new vis.DataSet(SERVICES.map(s => ({ 
    id: s.id, 
    label: s.label, 
    shape: 'box', 
    font: { color: '#fff', size: 16 },
    color: getStatusColor('unknown'),
    level: s.level,
    x: getNodeX(s.id, s.level),
    y: getNodeY(s.level),
    physics: false,
    title: `${s.label}: ${s.description}`,
    borderWidth: 3,
    shadow: true
  })));
  
  const edges = new vis.DataSet(EDGES.map((e,i) => ({ 
    id: `edge-${i}`, 
    from: e.from, 
    to: e.to, 
    arrows: 'to', 
    color: { color: '#888' },
    width: 2,
    smooth: { type: 'cubicBezier', roundness: 0.3 },
    title: `${e.from} → ${e.to}: ${e.description}`,
    label: e.topic,
    font: { size: 10, color: '#888' }
  })));
  
  const options = {
    physics: { enabled: false },
    interaction: { 
      hover: true,
      tooltipDelay: 200
    },
    layout: { hierarchical: false },
    edges: {
      smooth: { type: 'cubicBezier', roundness: 0.3 },
      width: 2,
      selectionWidth: 4,
      hoverWidth: 3
    },
    nodes: {
      shape: 'box',
      font: { color: '#fff', size: 16 },
      borderWidth: 3,
      shadow: true,
      selectionWidth: 4,
      hoverWidth: 3
    },
    groups: {
      ai: {
        color: { background: '#2d3436', border: '#00b894' },
        font: { color: '#00b894' }
      },
      robot: {
        color: { background: '#2d3436', border: '#e17055' },
        font: { color: '#e17055' }
      },
      infra: {
        color: { background: '#2d3436', border: '#74b9ff' },
        font: { color: '#74b9ff' }
      },
      external: {
        color: { background: '#2d3436', border: '#fdcb6e' },
        font: { color: '#fdcb6e' }
      }
    }
  };
  
  const network = new vis.Network(container, {nodes, edges}, options);

  network.on('click', params => {
    if (params.nodes.length) {
      const nodeId = params.nodes[0];
      const svc = SERVICES.find(s => s.id === nodeId);
      if (svc && svc.url) {
        window.location.href = svc.url;
      }
    }
  });

  // Service status monitoring
  async function checkServiceStatus() {
    try {
      // Get all service statuses in one call
      const response = await fetch('/api/services/status', {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        const services = data.services || {};
        
        Object.keys(services).forEach(serviceId => {
          const serviceData = services[serviceId];
          const status = serviceData.status || 'unknown';
          serviceStatus[serviceId] = { 
            status, 
            data: serviceData, 
            lastCheck: Date.now() 
          };
          updateServiceNode(serviceId, status);
        });
        
        updateServiceStatusDisplay();
        updateSystemStats();
      } else {
        console.error('Failed to fetch service status');
      }
    } catch (error) {
      console.error('Error checking service status:', error);
    }
  }

  function updateServiceNode(serviceId, status) {
    const node = nodes.get(serviceId);
    if (node) {
      nodes.update({
        id: serviceId,
        color: getStatusColor(status)
      });
    }
  }

  function updateServiceStatusDisplay() {
    const statusList = document.getElementById('serviceStatusList');
    statusList.innerHTML = '';

    SERVICES.forEach(service => {
      const status = serviceStatus[service.id] || { status: 'unknown', lastCheck: 0 };
      const statusItem = document.createElement('div');
      statusItem.className = 'service-status';
      
      const timeSinceCheck = Date.now() - status.lastCheck;
      const isStale = timeSinceCheck > 30000; // 30 seconds
      
      // Get additional status info
      const statusData = status.data || {};
      const uptime = statusData.uptime || 'Unknown';
      const isRunning = statusData.is_running || false;
      const portListening = statusData.port_listening || false;
      
      let statusDetails = '';
      if (statusData.is_running !== undefined) {
        statusDetails += `Process: ${isRunning ? 'Running' : 'Stopped'}`;
      }
      if (statusData.port_listening !== undefined) {
        statusDetails += ` | Port: ${portListening ? 'Listening' : 'Closed'}`;
      }
      if (uptime && uptime !== 'Unknown') {
        statusDetails += ` | Uptime: ${uptime}`;
      }
      
      statusItem.innerHTML = `
        <div>
          <div class="service-name">${service.label}</div>
          <div class="service-description">${service.description}</div>
          ${statusDetails ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">${statusDetails}</div>` : ''}
        </div>
        <div>
          <span class="status-indicator ${status.status === 'up' ? '' : 'status-offline'} ${isStale ? 'status-warning' : ''}"></span>
          <span style="font-size: 10px; color: #888;">${status.status.toUpperCase()}</span>
        </div>
      `;
      
      statusList.appendChild(statusItem);
    });
  }

  async function updateSystemStats() {
    try {
      // Get system stats from API
      const response = await fetch('/api/system/stats', {
        method: 'GET',
        timeout: 3000
      });
      
      if (response.ok) {
        const stats = await response.json();
        
        const totalServices = SERVICES.length;
        const activeServices = Object.values(serviceStatus).filter(s => s.status === 'up').length;
        
        document.getElementById('totalServices').textContent = totalServices;
        document.getElementById('activeServices').textContent = activeServices;
        document.getElementById('messageCount').textContent = messageCount;
        document.getElementById('uptime').textContent = stats.uptime || '0s';
        
        // Add CPU and memory info to the stats
        if (stats.cpu_percent !== undefined) {
          const cpuElement = document.getElementById('cpuPercent');
          if (cpuElement) {
            cpuElement.textContent = `${stats.cpu_percent.toFixed(1)}%`;
          }
        }
        
        if (stats.memory && stats.memory.percent !== undefined) {
          const memElement = document.getElementById('memoryPercent');
          if (memElement) {
            memElement.textContent = `${stats.memory.percent.toFixed(1)}%`;
          }
        }
      } else {
        // Fallback to basic stats
        const totalServices = SERVICES.length;
        const activeServices = Object.values(serviceStatus).filter(s => s.status === 'up').length;
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        document.getElementById('totalServices').textContent = totalServices;
        document.getElementById('activeServices').textContent = activeServices;
        document.getElementById('messageCount').textContent = messageCount;
        document.getElementById('uptime').textContent = `${uptime}s`;
      }
    } catch (error) {
      console.error('Error updating system stats:', error);
      // Fallback to basic stats
      const totalServices = SERVICES.length;
      const activeServices = Object.values(serviceStatus).filter(s => s.status === 'up').length;
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      
      document.getElementById('totalServices').textContent = totalServices;
      document.getElementById('activeServices').textContent = activeServices;
      document.getElementById('messageCount').textContent = messageCount;
      document.getElementById('uptime').textContent = `${uptime}s`;
    }
  }

  // Poll pubsub log for real-time updates
  let lastLogSize = 0;
  let pollInterval;
  
  async function pollPubsubLog() {
    try {
      const response = await fetch('/api/pubsub/log');
      if (response.ok) {
        const logEntries = await response.json();
        
        // Process new entries since last poll
        const newEntries = logEntries.slice(lastLogSize);
        lastLogSize = logEntries.length;
        
        newEntries.forEach(entry => {
          processPubsubEntry(entry);
        });
        
        updateConnectionStatus(true);
      }
    } catch (error) {
      console.error('Error polling pubsub log:', error);
      updateConnectionStatus(false);
    }
  }
  
  function processPubsubEntry(entry) {
    const { topic, source, data } = entry;
    messageCount++;
    lastMessageTime = Date.now();
    
    // Map topic to edge
    const edgeMapping = EDGES.reduce((acc, edge, index) => {
      acc[edge.topic] = { edgeIndex: index, ...edge };
      return acc;
    }, {});
    
    const mapping = edgeMapping[topic];
    if (mapping) {
      pulseEdge(`edge-${mapping.edgeIndex}`);
      addLogEntry(mapping.from, mapping.to, data, topic);
    }
  }
  
  // Start polling every 500ms
  pollInterval = setInterval(pollPubsubLog, 500);
  
  // Check service status every 10 seconds
  setInterval(checkServiceStatus, 10000);
  
  // Initial status check
  checkServiceStatus();

  // Update system stats every 5 seconds
  setInterval(updateSystemStats, 5000);
  
  // Initial system stats update
  updateSystemStats();

  // Logging functions
  function addLogEntry(from, to, data = null, topic = null) {
    if (logPaused) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logContent = document.getElementById('logContent');
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry info';
    
    let dataDisplay = '';
    if (data) {
      if (typeof data === 'object') {
        dataDisplay = JSON.stringify(data, null, 2).substring(0, 100);
        if (dataDisplay.length >= 100) dataDisplay += '...';
      } else {
        dataDisplay = String(data).substring(0, 100);
      }
    }
    
    logEntry.innerHTML = `
      <div class="log-timestamp">${timestamp} [${messageCount}]</div>
      <div class="log-message">
        <span class="log-source">${from.toUpperCase()}</span> → 
        <span class="log-target">${to.toUpperCase()}</span>
        ${topic ? `<span style="color: #888; font-size: 10px;"> (${topic})</span>` : ''}
      </div>
      ${dataDisplay ? `<div class="log-data">${dataDisplay}</div>` : ''}
    `;
    
    logContent.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logContent.scrollTop = logContent.scrollHeight;
    
    // Limit log entries
    while (logContent.children.length > maxLogEntries) {
      logContent.removeChild(logContent.firstChild);
    }
  }

  function clearLog() {
    const logContent = document.getElementById('logContent');
    logContent.innerHTML = '';
    messageCount = 0;
  }

  function toggleLogPause() {
    logPaused = !logPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = logPaused ? 'Resume' : 'Pause';
    pauseBtn.style.background = logPaused ? '#d63031' : '#444';
  }

  // Edge pulsing with cyan color
  function pulseEdge(edgeId) {
    const edge = edges.get(edgeId); 
    if (!edge) return;
    
    // Pulse the edge with cyan color
    edges.update({
      id: edgeId,
      color: { color: '#00ffff' },
      width: 4
    });
    
    setTimeout(() => {
      edges.update({
        id: edgeId,
        color: { color: '#888' },
        width: 2
      });
    }, 300);
  }

  // Position nodes in a hierarchical layout
  function getNodeX(nodeId, level) {
    const levelNodes = SERVICES.filter(s => s.level === level);
    const nodeIndex = levelNodes.findIndex(s => s.id === nodeId);
    const totalNodes = levelNodes.length;
    const spacing = 350;
    const centerX = 0;
    
    // Special case: center LLM at level 1
    if (level === 1 && nodeId === 'llm') {
      return 0; // Center position
    }
    
    const startX = centerX - (totalNodes - 1) * spacing / 2;
    return startX + nodeIndex * spacing;
  }
  
  function getNodeY(level) {
    const levelSpacing = 250;
    return level * levelSpacing - 400; // Center vertically
  }

  function getStatusColor(status) { 
    switch(status) {
      case 'up': 
        return { background: '#00b894', border: '#00b894' }; // Green for running
      case 'down': 
        return { background: '#d63031', border: '#d63031' }; // Red for stopped
      case 'warning': 
        return { background: '#fdcb6e', border: '#fdcb6e' }; // Yellow for warning
      default: 
        return { background: '#636e72', border: '#b2bec3' }; // Gray for unknown
    }
  }
  
  // Initialize log controls
  document.getElementById('pauseBtn').addEventListener('click', toggleLogPause);
  document.getElementById('clearBtn').addEventListener('click', clearLog);
  
  // Update connection status based on log polling
  function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connectionStatus');
    if (connected) {
      statusIndicator.className = 'status-indicator';
    } else {
      statusIndicator.className = 'status-indicator status-offline';
    }
  }
  
  // Initial connection check
  pollPubsubLog().then(() => {
    updateConnectionStatus(true);
    addLogEntry('system', 'log', 'Pubsub log polling started');
  }).catch(() => {
    updateConnectionStatus(false);
    addLogEntry('system', 'log', 'Failed to connect to pubsub log');
  });
  
  // Initial log entry
  setTimeout(() => {
    addLogEntry('system', 'log', 'Architecture visualization initialized with all services');
  }, 1000);
  
  // Update uptime every second (now handled by updateSystemStats)
  setInterval(() => {
    // This is now handled by the dedicated updateSystemStats function
  }, 1000);
})();
