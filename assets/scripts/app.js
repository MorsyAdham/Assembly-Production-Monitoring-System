// ==================== ASSEMBLY PRODUCTION MONITORING SYSTEM ====================
// Version: 2.0.0 - With Audit Logging & Telegram Integration
// Author: Adham Morsy
// Description: Complete application logic with audit trail and notifications

// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = "https://biqwfqkuhebxcfucangt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcXdmcWt1aGVieGNmdWNhbmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNzM5NzQsImV4cCI6MjA4MTk0OTk3NH0.QkASAl8yzXfxVq0b0FdkXHTOpblldr2prCnImpV8ml8";

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
}

// ==================== GLOBAL STATE ====================
let currentUser = null;
let allRequests = [];
let allVehicles = [];
let allProductionStatus = [];
let allUsers = [];
let allAuditLogs = [];
let chartInstances = {};
let filteredRequests = [];
let telegramConfig = null;
let currentProductionFilters = {
    vehicle: '',
    status: ''
};

// Station configurations
const STATIONS = {
    K9: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11'],
    K10: ['A01', 'A12', 'A13', 'A14', 'A15', 'A16'],
    K11: ['A01', 'A12', 'A13', 'A14', 'A15', 'A16']
};

// ==================== AUDIT LOGGING FUNCTIONS ====================

/**
 * Log action to audit trail
 */
async function logAudit(actionType, entityType, entityId, oldValues, newValues, description) {
    try {
        const auditData = {
            username: currentUser?.username || 'system',
            user_id: currentUser?.id || null,
            user_role: currentUser?.role || null,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId,
            old_values: oldValues ? JSON.stringify(oldValues) : null,
            new_values: newValues ? JSON.stringify(newValues) : null,
            description: description,
            ip_address: await getClientIP()
        };

        const { data, error } = await supabase
            .from('assembly_audit_logs')
            .insert([auditData])
            .select();

        if (error) {
            console.error('Audit log error:', error);
            return null;
        }

        // Send Telegram notification
        await sendTelegramNotification(auditData);

        return data[0];
    } catch (err) {
        console.error('Error logging audit:', err);
        return null;
    }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

/**
 * Fetch Telegram configuration
 */
async function fetchTelegramConfig() {
    try {
        const { data, error } = await supabase
            .from('telegram_config')
            .select('*')
            .single();

        if (error) throw error;
        telegramConfig = data;
        return data;
    } catch (err) {
        console.error('Error fetching Telegram config:', err);
        return null;
    }
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(auditData) {
    if (!telegramConfig || !telegramConfig.enabled) return;

    try {
        const actionEmoji = {
            'login': '🔐',
            'create': '✅',
            'update': '✏️',
            'delete': '🗑️'
        };

        const entityEmoji = {
            'request': '📝',
            'vehicle': '🚗',
            'production_status': '🏭',
            'user': '👤',
            'session': '🔑'
        };

        const message = `
${actionEmoji[auditData.action_type] || '📌'} *Assembly Production System*

*Action:* ${auditData.action_type.toUpperCase()}
*Entity:* ${entityEmoji[auditData.entity_type] || ''} ${auditData.entity_type}
*User:* ${auditData.username} (${auditData.user_role || 'N/A'})
*Description:* ${auditData.description}
*Time:* ${new Date().toLocaleString()}
*IP:* ${auditData.ip_address}
${auditData.new_values ? `\n*Details:* \`${JSON.stringify(JSON.parse(auditData.new_values)).substring(0, 200)}\`` : ''}
        `.trim();

        const telegramApiUrl = `https://api.telegram.org/bot${telegramConfig.bot_token}/sendMessage`;
        
        await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: telegramConfig.chat_id,
                text: message,
                parse_mode: 'Markdown'
            })
        });

    } catch (err) {
        console.error('Error sending Telegram notification:', err);
    }
}

/**
 * Fetch audit logs
 */
async function fetchAuditLogs() {
    try {
        const { data, error } = await supabase
            .from('assembly_audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(500);

        if (error) throw error;
        allAuditLogs = data || [];
        return allAuditLogs;
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        return [];
    }
}

// ==================== UTILITY FUNCTIONS ====================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => {
            el.style.display = 'none';
        }, 5000);
    }
}

function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => {
            el.style.display = 'none';
        }, 3000);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== AUTHENTICATION ====================

function checkAuth() {
    const userStr = sessionStorage.getItem('currentUser');
    
    if (!userStr) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return false;
    }
    
    if (window.location.pathname.includes('login.html')) {
        window.location.href = 'index.html';
        return false;
    }
    
    currentUser = JSON.parse(userStr);
    
    const emailEl = document.getElementById('userEmail');
    const roleEl = document.getElementById('userRole');
    
    if (emailEl) emailEl.textContent = currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role.replace('_', ' ').toUpperCase();
        roleEl.className = `user-badge role-badge ${currentUser.role.replace('_', '-')}`;
    }
    
    applyRolePermissions();
    
    return true;
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorEl = document.getElementById('error');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginSpinner = document.getElementById('loginSpinner');
    
    errorEl.textContent = '';
    errorEl.style.display = 'none';
    
    if (!username || !password) {
        showError('error', 'Please enter both username and password');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtnText.style.display = 'none';
    loginSpinner.style.display = 'inline-block';
    
    try {
        const passwordHash = await hashPassword(password);
        
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password_hash', passwordHash)
            .single();
        
        if (error || !data) {
            showError('error', 'Invalid username or password');
            
            await logAudit(
                'login',
                'session',
                null,
                null,
                { username, success: false },
                `Failed login attempt for user: ${username}`
            );
            return;
        }
        
        sessionStorage.setItem('currentUser', JSON.stringify({
            username: data.username,
            role: data.role,
            id: data.id
        }));
        
        currentUser = {
            username: data.username,
            role: data.role,
            id: data.id
        };
        
        await logAudit(
            'login',
            'session',
            data.id,
            null,
            { username: data.username, role: data.role },
            `User ${data.username} logged in successfully`
        );
        
        window.location.href = 'index.html';
        
    } catch (err) {
        console.error('Login error:', err);
        showError('error', 'An error occurred during login. Please try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtnText.style.display = 'inline';
        loginSpinner.style.display = 'none';
    }
}

function logout() {
    if (currentUser) {
        logAudit(
            'login',
            'session',
            currentUser.id,
            null,
            { username: currentUser.username, action: 'logout' },
            `User ${currentUser.username} logged out`
        );
    }
    
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

function applyRolePermissions() {
    if (!currentUser) return;
    
    const role = currentUser.role;
    
    const userMgmtSection = document.getElementById('userManagementSection');
    if (userMgmtSection) {
        userMgmtSection.style.display = role === 'master_admin' ? 'block' : 'none';
    }
    
    const addRequestSection = document.getElementById('addRequestSection');
    if (addRequestSection) {
        addRequestSection.style.display = ['master_admin', 'admin', 'customer'].includes(role) ? 'block' : 'none';
    }
    
    const addVehicleSection = document.getElementById('addVehicleSection');
    if (addVehicleSection) {
        addVehicleSection.style.display = ['master_admin', 'admin'].includes(role) ? 'block' : 'none';
    }
    
    const actionsHeader = document.getElementById('actionsHeader');
    const prodActionsHeader = document.getElementById('prodActionsHeader');
    if (actionsHeader) {
        actionsHeader.style.display = ['master_admin', 'admin'].includes(role) ? 'table-cell' : 'none';
    }
    if (prodActionsHeader) {
        prodActionsHeader.style.display = ['master_admin', 'admin'].includes(role) ? 'table-cell' : 'none';
    }
    
    const auditLogsBtn = document.getElementById('auditLogsBtn');
    if (auditLogsBtn) {
        auditLogsBtn.style.display = role === 'master_admin' ? 'inline-flex' : 'none';
    }
}

// ==================== DATA FETCHING ====================

async function fetchRequests() {
    try {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .order('request_date', { ascending: false });
        
        if (error) throw error;
        
        allRequests = data || [];
        
        if (currentUser && currentUser.role === 'customer') {
            allRequests = allRequests.filter(r => r.requested_by === currentUser.username);
        }
        
        return allRequests;
    } catch (err) {
        console.error('Error fetching requests:', err);
        return [];
    }
}

async function fetchVehicles() {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .order('vehicle_type', { ascending: true });
        
        if (error) throw error;
        allVehicles = data || [];
        return allVehicles;
    } catch (err) {
        console.error('Error fetching vehicles:', err);
        return [];
    }
}

async function fetchProductionStatus() {
    try {
        const { data, error } = await supabase
            .from('production_status')
            .select('*')
            .order('vehicle_number', { ascending: true });
        
        if (error) throw error;
        allProductionStatus = data || [];
        return allProductionStatus;
    } catch (err) {
        console.error('Error fetching production status:', err);
        return [];
    }
}

async function fetchUsers() {
    if (currentUser.role !== 'master_admin') return [];
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        allUsers = data || [];
        return allUsers;
    } catch (err) {
        console.error('Error fetching users:', err);
        return [];
    }
}

// ==================== CRUD OPERATIONS WITH AUDIT LOGGING ====================

async function createRequest() {
    const vehicleType = document.getElementById('reqVehicleType').value;
    const vehicleNumber = document.getElementById('reqVehicleNumber').value;
    const stationCode = document.getElementById('reqStationCode').value;
    const requestType = document.getElementById('reqType').value;
    
    if (!vehicleType || !vehicleNumber || !stationCode || !requestType) {
        showError('requestError', 'Please fill in all required fields');
        return;
    }
    
    const requestData = {
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        station_code: stationCode,
        request_type: requestType,
        status: 'open',
        requested_by: currentUser.username,
        fastener: false
    };
    
    if (requestType === 'part') {
        const partNumber = document.getElementById('reqPartNumber').value.trim();
        const qty = parseInt(document.getElementById('reqQty').value);
        const fastener = document.getElementById('reqFastener').checked;
        
        if (!partNumber || !qty) {
            showError('requestError', 'Part number and quantity are required for part requests');
            return;
        }
        
        requestData.part_number = partNumber;
        requestData.qty = qty;
        requestData.fastener = fastener;
    }
    
    try {
        const { data, error } = await supabase
            .from('requests')
            .insert([requestData])
            .select();
        
        if (error) throw error;
        
        await logAudit(
            'create',
            'request',
            data[0].id,
            null,
            requestData,
            `Created ${requestType} request for ${vehicleNumber} at station ${stationCode}`
        );
        
        showSuccess('requestSuccess', 'Request created successfully!');
        
        document.getElementById('reqVehicleType').value = '';
        document.getElementById('reqVehicleNumber').value = '';
        document.getElementById('reqStationCode').value = '';
        document.getElementById('reqType').value = '';
        document.getElementById('reqPartNumber').value = '';
        document.getElementById('reqQty').value = '';
        document.getElementById('reqFastener').checked = false;
        document.getElementById('partFields').style.display = 'none';
        
        await refreshDashboard();
        
    } catch (err) {
        console.error('Error creating request:', err);
        showError('requestError', 'Failed to create request. Please try again.');
    }
}

async function updateRequestStatus(requestId, newStatus) {
    try {
        const oldRequest = allRequests.find(r => r.id === requestId);
        
        const { data, error } = await supabase
            .from('requests')
            .update({ status: newStatus })
            .eq('id', requestId)
            .select();
        
        if (error) throw error;
        
        await logAudit(
            'update',
            'request',
            requestId,
            { status: oldRequest.status },
            { status: newStatus },
            `Updated request status from ${oldRequest.status} to ${newStatus} for vehicle ${oldRequest.vehicle_number}`
        );
        
        await refreshDashboard();
        
    } catch (err) {
        console.error('Error updating request status:', err);
        alert('Failed to update request status');
    }
}

async function deleteRequest(requestId) {
    if (!confirm('Are you sure you want to delete this request?')) return;
    
    try {
        const request = allRequests.find(r => r.id === requestId);
        
        const { error } = await supabase
            .from('requests')
            .delete()
            .eq('id', requestId);
        
        if (error) throw error;
        
        await logAudit(
            'delete',
            'request',
            requestId,
            request,
            null,
            `Deleted request for vehicle ${request.vehicle_number} at station ${request.station_code}`
        );
        
        await refreshDashboard();
        
    } catch (err) {
        console.error('Error deleting request:', err);
        alert('Failed to delete request');
    }
}

async function createVehicle() {
    const vehicleType = document.getElementById('newVehicleType').value;
    const vehicleNumber = document.getElementById('newVehicleNumber').value.trim();
    
    if (!vehicleType || !vehicleNumber) {
        showError('vehicleError', 'Please fill in all fields');
        return;
    }
    
    try {
        const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicles')
            .insert([{ vehicle_type: vehicleType, vehicle_number: vehicleNumber }])
            .select();
        
        if (vehicleError) throw vehicleError;
        
        const stations = STATIONS[vehicleType];
        const statusRecords = stations.map(station => ({
            vehicle_number: vehicleNumber,
            station_code: station,
            status: 'pending'
        }));
        
        const { error: statusError } = await supabase
            .from('production_status')
            .insert(statusRecords);
        
        if (statusError) throw statusError;
        
        await logAudit(
            'create',
            'vehicle',
            vehicleData[0].id,
            null,
            { vehicle_type: vehicleType, vehicle_number: vehicleNumber, stations: stations.length },
            `Created new vehicle ${vehicleNumber} (${vehicleType}) with ${stations.length} stations`
        );
        
        showSuccess('vehicleSuccess', 'Vehicle added successfully!');
        
        document.getElementById('newVehicleType').value = '';
        document.getElementById('newVehicleNumber').value = '';
        
        await refreshDashboard();
        
    } catch (err) {
        console.error('Error creating vehicle:', err);
        if (err.code === '23505') {
            showError('vehicleError', 'Vehicle number already exists');
        } else {
            showError('vehicleError', 'Failed to add vehicle. Please try again.');
        }
    }
}

async function updateProductionStatus(vehicleNumber, stationCode, newStatus) {
    try {
        const oldStatus = allProductionStatus.find(
            s => s.vehicle_number === vehicleNumber && s.station_code === stationCode
        );
        
        const { data, error } = await supabase
            .from('production_status')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('vehicle_number', vehicleNumber)
            .eq('station_code', stationCode)
            .select();
        
        if (error) throw error;
        
        await logAudit(
            'update',
            'production_status',
            data[0].id,
            { status: oldStatus.status },
            { status: newStatus },
            `Updated production status for ${vehicleNumber} station ${stationCode} from ${oldStatus.status} to ${newStatus}`
        );
        
        await refreshDashboard();
        
        // Reapply filters after refresh
        if (currentProductionFilters.vehicle || currentProductionFilters.status) {
            const vehicleSelect = document.getElementById('filterProdVehicle');
            const statusSelect = document.getElementById('filterProdStatus');
            
            if (vehicleSelect) vehicleSelect.value = currentProductionFilters.vehicle;
            if (statusSelect) statusSelect.value = currentProductionFilters.status;
            
            applyProductionFilters();
        }
        
    } catch (err) {
        console.error('Error updating production status:', err);
        alert('Failed to update production status');
    }
}

async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const role = document.getElementById('newUserRole').value;
    
    if (!username || !password || !role) {
        showError('userError', 'Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('userError', 'Password must be at least 6 characters');
        return;
    }
    
    try {
        const passwordHash = await hashPassword(password);
        
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username: username,
                password_hash: passwordHash,
                role: role
            }])
            .select();
        
        if (error) throw error;
        
        await logAudit(
            'create',
            'user',
            data[0].id,
            null,
            { username, role },
            `Created new user: ${username} with role: ${role}`
        );
        
        showSuccess('userSuccess', 'User created successfully!');
        
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newUserRole').value = '';
        document.getElementById('addUserForm').style.display = 'none';
        
        await fetchUsers();
        renderUsersTable();
        
    } catch (err) {
        console.error('Error creating user:', err);
        if (err.code === '23505') {
            showError('userError', 'Username already exists');
        } else {
            showError('userError', 'Failed to create user. Please try again.');
        }
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const user = allUsers.find(u => u.id === userId);
        
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        await logAudit(
            'delete',
            'user',
            userId,
            { username: user.username, role: user.role },
            null,
            `Deleted user: ${user.username}`
        );
        
        await fetchUsers();
        renderUsersTable();
        
    } catch (err) {
        console.error('Error deleting user:', err);
        alert('Failed to delete user');
    }
}

async function resetUserPassword(userId) {
    const newPassword = prompt('Enter new password (min 6 characters):');
    
    if (!newPassword || newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        const user = allUsers.find(u => u.id === userId);
        const passwordHash = await hashPassword(newPassword);
        
        const { error } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', userId);
        
        if (error) throw error;
        
        await logAudit(
            'update',
            'user',
            userId,
            null,
            { action: 'password_reset' },
            `Reset password for user: ${user.username}`
        );
        
        alert('Password updated successfully!');
        
    } catch (err) {
        console.error('Error resetting password:', err);
        alert('Failed to reset password');
    }
}

// ==================== RENDERING FUNCTIONS ====================

function renderRequestsTable(requests = allRequests) {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No requests found</td></tr>';
        return;
    }
    
    requests.forEach(request => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${request.vehicle_number}</td>
            <td>${request.station_code}</td>
            <td><span class="badge badge-${request.request_type}">${request.request_type}</span></td>
            <td>${request.part_number || '-'}</td>
            <td>${request.qty || '-'}</td>
            <td>${request.fastener ? '✓' : '-'}</td>
            <td><span class="badge badge-${request.status}">${request.status}</span></td>
            <td>${request.requested_by}</td>
            <td>${formatDate(request.request_date)}</td>
            <td>${formatDate(request.delivery_date)}</td>
            <td class="actions-cell" ${['master_admin', 'admin'].includes(currentUser.role) ? '' : 'style="display:none;"'}>
                ${request.status === 'open' ? `
                    <button class="btn-icon" onclick="updateRequestStatus('${request.id}', 'delivered')" title="Mark as Delivered">
                        ✓
                    </button>
                ` : ''}
                <button class="btn-icon delete" onclick="deleteRequest('${request.id}')" title="Delete Request">
                    🗑️
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function renderProductionTable(statusData = allProductionStatus) {
    const tbody = document.getElementById('productionTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (statusData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No production data found</td></tr>';
        return;
    }
    
    statusData.forEach(item => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${item.vehicle_number}</strong></td>
            <td>${item.station_code}</td>
            <td>
                <span class="badge badge-${item.status.replace('_', '-')}">${item.status.replace('_', ' ')}</span>
            </td>
            <td>${formatDate(item.updated_at)}</td>
            <td class="actions-cell" ${['master_admin', 'admin'].includes(currentUser.role) ? '' : 'style="display:none;"'}>
                <select onchange="updateProductionStatus('${item.vehicle_number}', '${item.station_code}', this.value); this.blur();" class="status-select">
                    <option value="">Update Status...</option>
                    <option value="pending" ${item.status === 'pending' ? 'disabled' : ''}>Pending</option>
                    <option value="in_progress" ${item.status === 'in_progress' ? 'disabled' : ''}>In Progress</option>
                    <option value="completed" ${item.status === 'completed' ? 'disabled' : ''}>Completed</option>
                </select>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function renderVehiclesTable(vehicles = allVehicles) {
    const tbody = document.getElementById('vehiclesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No vehicles found</td></tr>';
        return;
    }
    
    vehicles.forEach(vehicle => {
        const vehicleStatus = allProductionStatus.filter(s => s.vehicle_number === vehicle.vehicle_number);
        const totalStations = vehicleStatus.length;
        const completed = vehicleStatus.filter(s => s.status === 'completed').length;
        const inProgress = vehicleStatus.filter(s => s.status === 'in_progress').length;
        const pending = vehicleStatus.filter(s => s.status === 'pending').length;
        const progress = totalStations > 0 ? Math.round((completed / totalStations) * 100) : 0;
        
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${vehicle.vehicle_number}</strong></td>
            <td><span class="badge badge-${vehicle.vehicle_type.toLowerCase()}">${vehicle.vehicle_type}</span></td>
            <td>${totalStations}</td>
            <td>${completed}</td>
            <td>${inProgress}</td>
            <td>${pending}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                    <span class="progress-text">${progress}%</span>
                </div>
            </td>
            <td>${formatDate(vehicle.created_at)}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No users found</td></tr>';
        return;
    }
    
    allUsers.forEach(user => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${user.username}</strong></td>
            <td><span class="badge badge-${user.role.replace('_', '-')}">${user.role.replace('_', ' ')}</span></td>
            <td>${formatDate(user.created_at)}</td>
            <td class="actions-cell">
                <button class="btn-icon" onclick="resetUserPassword('${user.id}')" title="Reset Password">
                    🔑
                </button>
                ${user.username !== currentUser.username ? `
                    <button class="btn-icon delete" onclick="deleteUser('${user.id}')" title="Delete User">
                        🗑️
                    </button>
                ` : ''}
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function updateSummaryCards() {
    const totalVehicles = document.getElementById('totalVehicles');
    if (totalVehicles) totalVehicles.textContent = allVehicles.length;
    
    const completedStations = document.getElementById('completedStations');
    if (completedStations) {
        const completed = allProductionStatus.filter(s => s.status === 'completed').length;
        completedStations.textContent = completed;
    }
    
    const pendingStations = document.getElementById('pendingStations');
    if (pendingStations) {
        const pending = allProductionStatus.filter(s => s.status === 'pending').length;
        pendingStations.textContent = pending;
    }
    
    const openRequests = document.getElementById('openRequests');
    if (openRequests) {
        const open = allRequests.filter(r => r.status === 'open').length;
        openRequests.textContent = open;
    }
}

// ==================== AUDIT LOG MODAL FUNCTIONS ====================

/**
 * Show audit logs modal (triggered from navbar button)
 */
async function showAuditLogsModal() {
    await fetchAuditLogs();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'auditLogsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1200px;">
            <div class="modal-header">
                <h3>📋 Audit Logs (${allAuditLogs.length} entries)</h3>
                <button class="btn-icon close-modal" onclick="closeModal(); event.stopPropagation();">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Filters -->
                <div class="filters" style="margin-bottom: 20px;">
                    <div class="filter-group">
                        <label for="modalFilterUser">Username</label>
                        <select id="modalFilterUser">
                            <option value="">All Users</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="modalFilterDateFrom">Date From</label>
                        <input type="date" id="modalFilterDateFrom">
                    </div>
                    <div class="filter-group">
                        <label for="modalFilterDateTo">Date To</label>
                        <input type="date" id="modalFilterDateTo">
                    </div>
                    <div class="filter-group">
                        <label for="modalFilterAction">Action Type</label>
                        <select id="modalFilterAction">
                            <option value="">All Actions</option>
                            <option value="login">Login</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="modalSearchAudit">Search</label>
                        <input type="text" id="modalSearchAudit" placeholder="Search description...">
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="exportAuditLogsToExcel(); event.stopPropagation();">
                        📊 Export to Excel
                    </button>
                    <button class="btn btn-secondary" onclick="applyAuditModalFilters(); event.stopPropagation();">
                        🔍 Apply Filters
                    </button>
                    <button class="btn btn-secondary" onclick="clearAuditModalFilters(); event.stopPropagation();">
                        🔄 Clear Filters
                    </button>
                </div>
                
                <!-- Table -->
                <div class="table-scroll" style="max-height: 500px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>Description</th>
                                <th>IP</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody id="auditModalTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate user filter
    populateAuditUserFilter();
    
    // Render initial table
    renderAuditModalTable(allAuditLogs);
    
    // Setup event listeners
    setupAuditModalListeners();
    
    // Modal close handlers
    const modalContent = modal.querySelector('.modal-content');
    modalContent.addEventListener('click', (e) => e.stopPropagation());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // ESC key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Populate user filter dropdown
 */
function populateAuditUserFilter() {
    const select = document.getElementById('modalFilterUser');
    if (!select) return;
    
    const uniqueUsers = [...new Set(allAuditLogs.map(log => log.username))].sort();
    
    select.innerHTML = '<option value="">All Users</option>';
    uniqueUsers.forEach(username => {
        const option = document.createElement('option');
        option.value = username;
        option.textContent = username;
        select.appendChild(option);
    });
}

/**
 * Setup audit modal event listeners
 */
function setupAuditModalListeners() {
    const filterUser = document.getElementById('modalFilterUser');
    const filterDateFrom = document.getElementById('modalFilterDateFrom');
    const filterDateTo = document.getElementById('modalFilterDateTo');
    const filterAction = document.getElementById('modalFilterAction');
    const searchInput = document.getElementById('modalSearchAudit');
    
    if (filterUser) filterUser.addEventListener('change', applyAuditModalFilters);
    if (filterDateFrom) filterDateFrom.addEventListener('change', applyAuditModalFilters);
    if (filterDateTo) filterDateTo.addEventListener('change', applyAuditModalFilters);
    if (filterAction) filterAction.addEventListener('change', applyAuditModalFilters);
    if (searchInput) searchInput.addEventListener('input', debounce(applyAuditModalFilters, 300));
}

/**
 * Apply audit modal filters
 */
function applyAuditModalFilters() {
    let filtered = [...allAuditLogs];
    
    const userFilter = document.getElementById('modalFilterUser')?.value;
    if (userFilter) {
        filtered = filtered.filter(log => log.username === userFilter);
    }
    
    const dateFrom = document.getElementById('modalFilterDateFrom')?.value;
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filtered = filtered.filter(log => new Date(log.timestamp) >= fromDate);
    }
    
    const dateTo = document.getElementById('modalFilterDateTo')?.value;
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(log => new Date(log.timestamp) <= toDate);
    }
    
    const actionFilter = document.getElementById('modalFilterAction')?.value;
    if (actionFilter) {
        filtered = filtered.filter(log => log.action_type === actionFilter);
    }
    
    const searchTerm = document.getElementById('modalSearchAudit')?.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(log => 
            log.description.toLowerCase().includes(searchTerm) ||
            log.username.toLowerCase().includes(searchTerm)
        );
    }
    
    renderAuditModalTable(filtered);
}

/**
 * Clear audit modal filters
 */
function clearAuditModalFilters() {
    document.getElementById('modalFilterUser').value = '';
    document.getElementById('modalFilterDateFrom').value = '';
    document.getElementById('modalFilterDateTo').value = '';
    document.getElementById('modalFilterAction').value = '';
    document.getElementById('modalSearchAudit').value = '';
    
    renderAuditModalTable(allAuditLogs);
}

/**
 * Render audit modal table
 */
function renderAuditModalTable(logs) {
    const tbody = document.getElementById('auditModalTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No audit logs found</td></tr>';
        return;
    }
    
    logs.forEach(log => {
        const tr = document.createElement('tr');
        
        const actionClass = {
            'login': 'badge-info',
            'create': 'badge-completed',
            'update': 'badge-in-progress',
            'delete': 'badge-open'
        };
        
        tr.innerHTML = `
            <td>${formatDate(log.timestamp)}</td>
            <td><strong>${log.username}</strong></td>
            <td><span class="badge ${actionClass[log.action_type] || 'badge-station'}">${log.action_type}</span></td>
            <td><span class="badge badge-station">${log.entity_type}</span></td>
            <td>${log.description}</td>
            <td>${log.ip_address || '-'}</td>
            <td>
                ${log.new_values || log.old_values ? `<button class="btn-icon" onclick="showAuditDetailsInModal('${log.id}'); event.stopPropagation();" title="View Details">👁️</button>` : '-'}
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Update count in header
    const header = document.querySelector('#auditLogsModal .modal-header h3');
    if (header) {
        header.textContent = `📋 Audit Logs (${logs.length} ${logs.length === allAuditLogs.length ? 'total' : 'filtered'})`;
    }
}

/**
 * Show audit details in a nested modal
 */
function showAuditDetailsInModal(logId) {
    const log = allAuditLogs.find(l => l.id === logId);
    if (!log) return;
    
    let detailsHTML = '<div style="padding: 20px;">';
    detailsHTML += `<h4>Audit Log Details</h4>`;
    detailsHTML += `<p><strong>Time:</strong> ${formatDate(log.timestamp)}</p>`;
    detailsHTML += `<p><strong>User:</strong> ${log.username} (${log.user_role || 'N/A'})</p>`;
    detailsHTML += `<p><strong>Action:</strong> ${log.action_type}</p>`;
    detailsHTML += `<p><strong>Entity:</strong> ${log.entity_type}</p>`;
    detailsHTML += `<p><strong>Description:</strong> ${log.description}</p>`;
    detailsHTML += `<p><strong>IP Address:</strong> ${log.ip_address || 'Unknown'}</p>`;
    
    if (log.old_values) {
        detailsHTML += `<p><strong>Old Values:</strong></p>`;
        detailsHTML += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; max-height: 200px;">${JSON.stringify(JSON.parse(log.old_values), null, 2)}</pre>`;
    }
    
    if (log.new_values) {
        detailsHTML += `<p><strong>New Values:</strong></p>`;
        detailsHTML += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; max-height: 200px;">${JSON.stringify(JSON.parse(log.new_values), null, 2)}</pre>`;
    }
    
    detailsHTML += '</div>';
    
    const detailModal = document.createElement('div');
    detailModal.className = 'modal-overlay';
    detailModal.style.zIndex = '10001';
    detailModal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h3>Audit Log Details</h3>
                <button class="btn-icon close-modal" onclick="this.closest('.modal-overlay').remove(); event.stopPropagation();">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
                ${detailsHTML}
            </div>
        </div>
    `;
    
    document.body.appendChild(detailModal);
    
    const modalContent = detailModal.querySelector('.modal-content');
    modalContent.addEventListener('click', (e) => e.stopPropagation());
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.remove();
        }
    });
}

/**
 * Export audit logs to Excel
 */
function exportAuditLogsToExcel() {
    try {
        const wb = XLSX.utils.book_new();
        
        const auditData = allAuditLogs.map(log => ({
            'Timestamp': formatDate(log.timestamp),
            'Username': log.username,
            'Role': log.user_role || '',
            'Action': log.action_type,
            'Entity': log.entity_type,
            'Description': log.description,
            'IP Address': log.ip_address || ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(auditData);
        XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
        
        XLSX.writeFile(wb, `audit-logs-${new Date().toISOString().split('T')[0]}.xlsx`);
        
    } catch (error) {
        console.error('Error exporting audit logs:', error);
        alert('Failed to export audit logs');
    }
}

// ==================== SUMMARY CARD FUNCTIONS ====================

function showVehiclesDetail() {
    const data = allVehicles.map(v => {
        const status = allProductionStatus.filter(s => s.vehicle_number === v.vehicle_number);
        const completed = status.filter(s => s.status === 'completed').length;
        const total = status.length;
        return {
            'Vehicle Number': v.vehicle_number,
            'Type': v.vehicle_type,
            'Total Stations': total,
            'Completed': completed,
            'Progress': total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%',
            'Created': formatDate(v.created_at)
        };
    });
    
    showDataModal('Total Vehicles', data, 'vehicles');
}

function showCompletedStationsDetail() {
    const completedStations = allProductionStatus.filter(s => s.status === 'completed');
    const data = completedStations.map(s => ({
        'Vehicle': s.vehicle_number,
        'Station': s.station_code,
        'Status': s.status,
        'Updated': formatDate(s.updated_at)
    }));
    
    showDataModal('Completed Stations', data, 'completed-stations');
}

function showPendingStationsDetail() {
    const pendingStations = allProductionStatus.filter(s => s.status === 'pending');
    const data = pendingStations.map(s => ({
        'Vehicle': s.vehicle_number,
        'Station': s.station_code,
        'Status': s.status,
        'Updated': formatDate(s.updated_at)
    }));
    
    showDataModal('Pending Stations', data, 'pending-stations');
}

function showOpenRequestsDetail() {
    const openRequests = allRequests.filter(r => r.status === 'open');
    const data = openRequests.map(r => ({
        'Vehicle': r.vehicle_number,
        'Station': r.station_code,
        'Type': r.request_type,
        'Part Number': r.part_number || '-',
        'Qty': r.qty || '-',
        'Fastener': r.fastener ? 'Yes' : 'No',
        'Requested By': r.requested_by,
        'Date': formatDate(r.request_date)
    }));
    
    showDataModal('Open Requests', data, 'open-requests');
}

function showDataModal(title, data, type) {
    closeModal();
    
    if (data.length === 0) {
        alert('No data to display');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title} (${data.length})</h3>
                <button class="btn-icon close-modal" onclick="closeModal(); event.stopPropagation();">&times;</button>
            </div>
            <div class="modal-body">
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="exportCardData('${type}', ${JSON.stringify(data).replace(/"/g, '&quot;')}); event.stopPropagation();">
                        📊 Export to Excel
                    </button>
                    <button class="btn btn-secondary" onclick="exportCardDataPDF('${title}', ${JSON.stringify(data).replace(/"/g, '&quot;')}); event.stopPropagation();">
                        📄 Export to PDF
                    </button>
                </div>
                <div class="table-scroll" style="max-height: 400px;">
                    <table>
                        <thead>
                            <tr>
                                ${Object.keys(data[0] || {}).map(key => `<th>${key}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr>
                                    ${Object.values(row).map(val => `<td>${val}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.addEventListener('click', (e) => e.stopPropagation());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeModal() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => modal.remove());
}

function exportCardData(type, data) {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, type);
        XLSX.writeFile(wb, `${type}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        console.error('Error exporting card data:', error);
        alert('Failed to export data');
    }
}

function exportCardDataPDF(title, data) {
    try {
        const { jsPDF} = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(title, 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`By: ${currentUser.username}`, 14, 34);
        doc.text(`Total Records: ${data.length}`, 14, 40);
        
        const tableData = data.map(row => Object.values(row));
        const headers = Object.keys(data[0] || {});
        
        doc.autoTable({
            startY: 46,
            head: [headers],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 168, 255] }
        });
        
        doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error('Error exporting card data to PDF:', error);
        alert('Failed to export PDF');
    }
}

function populateVehicleNumbers() {
    const vehicleType = document.getElementById('reqVehicleType').value;
    const vehicleNumberSelect = document.getElementById('reqVehicleNumber');
    
    if (!vehicleNumberSelect) return;
    
    vehicleNumberSelect.innerHTML = '<option value="">Select vehicle...</option>';
    
    if (!vehicleType) return;
    
    const filteredVehicles = allVehicles.filter(v => v.vehicle_type === vehicleType);
    
    filteredVehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.vehicle_number;
        option.textContent = vehicle.vehicle_number;
        vehicleNumberSelect.appendChild(option);
    });
}

function populateStations() {
    const vehicleType = document.getElementById('reqVehicleType').value;
    const stationSelect = document.getElementById('reqStationCode');
    
    if (!stationSelect) return;
    
    stationSelect.innerHTML = '<option value="">Select station...</option>';
    
    if (!vehicleType) return;
    
    const stations = STATIONS[vehicleType] || [];
    
    stations.forEach(station => {
        const option = document.createElement('option');
        option.value = station;
        option.textContent = station;
        stationSelect.appendChild(option);
    });
}

function populateProductionVehicleFilter() {
    const filterSelect = document.getElementById('filterProdVehicle');
    if (!filterSelect) return;
    
    filterSelect.innerHTML = '<option value="">All Vehicles</option>';
    
    allVehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.vehicle_number;
        option.textContent = vehicle.vehicle_number;
        filterSelect.appendChild(option);
    });
}

// ==================== FILTERING ====================

function applyRequestFilters() {
    let filtered = [...allRequests];
    
    const statusFilter = document.getElementById('filterStatus').value;
    if (statusFilter) {
        filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    const typeFilter = document.getElementById('filterReqType').value;
    if (typeFilter) {
        filtered = filtered.filter(r => r.request_type === typeFilter);
    }
    
    const vehicleTypeFilter = document.getElementById('filterVehicleType').value;
    if (vehicleTypeFilter) {
        filtered = filtered.filter(r => r.vehicle_type === vehicleTypeFilter);
    }
    
    const fastenerFilter = document.getElementById('filterFastener')?.value;
    if (fastenerFilter) {
        if (fastenerFilter === 'yes') {
            filtered = filtered.filter(r => r.fastener === true);
        } else if (fastenerFilter === 'no') {
            filtered = filtered.filter(r => r.fastener === false || r.fastener === null);
        }
    }
    
    const searchTerm = document.getElementById('searchRequest').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(r => 
            (r.part_number && r.part_number.toLowerCase().includes(searchTerm)) ||
            r.vehicle_number.toLowerCase().includes(searchTerm) ||
            r.station_code.toLowerCase().includes(searchTerm)
        );
    }
    
    filteredRequests = filtered;
    
    renderRequestsTable(filtered);
}

function applyProductionFilters() {
    let filtered = [...allProductionStatus];
    
    const vehicleFilter = document.getElementById('filterProdVehicle').value;
    const statusFilter = document.getElementById('filterProdStatus').value;
    
    // Store filter state
    currentProductionFilters.vehicle = vehicleFilter;
    currentProductionFilters.status = statusFilter;
    
    if (vehicleFilter) {
        filtered = filtered.filter(s => s.vehicle_number === vehicleFilter);
    }
    
    if (statusFilter) {
        filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    renderProductionTable(filtered);
}

function applyVehicleFilters() {
    let filtered = [...allVehicles];
    
    const typeFilter = document.getElementById('filterVehicles').value;
    if (typeFilter) {
        filtered = filtered.filter(v => v.vehicle_type === typeFilter);
    }
    
    renderVehiclesTable(filtered);
}

// ==================== ANALYTICS & CHARTS ====================

function generateCharts() {
    generateProductionByTypeChart();
    generateRequestStatusChart();
    generateRequestTimelineChart();
    generateRequestTypeChart();
}

function generateProductionByTypeChart() {
    const canvas = document.getElementById('productionByTypeChart');
    if (!canvas) return;
    
    if (chartInstances.productionByType) {
        chartInstances.productionByType.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    const types = ['K9', 'K10', 'K11'];
    const completedData = [];
    const pendingData = [];
    const inProgressData = [];
    
    types.forEach(type => {
        const vehiclesOfType = allVehicles.filter(v => v.vehicle_type === type);
        const vehicleNumbers = vehiclesOfType.map(v => v.vehicle_number);
        const statusOfType = allProductionStatus.filter(s => vehicleNumbers.includes(s.vehicle_number));
        
        completedData.push(statusOfType.filter(s => s.status === 'completed').length);
        inProgressData.push(statusOfType.filter(s => s.status === 'in_progress').length);
        pendingData.push(statusOfType.filter(s => s.status === 'pending').length);
    });
    
    chartInstances.productionByType = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: types,
            datasets: [
                {
                    label: 'Completed',
                    data: completedData,
                    backgroundColor: '#44bd32'
                },
                {
                    label: 'In Progress',
                    data: inProgressData,
                    backgroundColor: '#f39c12'
                },
                {
                    label: 'Pending',
                    data: pendingData,
                    backgroundColor: '#e84118'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function generateRequestStatusChart() {
    const canvas = document.getElementById('requestStatusChart');
    if (!canvas) return;
    
    if (chartInstances.requestStatus) {
        chartInstances.requestStatus.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    const openCount = allRequests.filter(r => r.status === 'open').length;
    const deliveredCount = allRequests.filter(r => r.status === 'delivered').length;
    
    chartInstances.requestStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'Delivered'],
            datasets: [{
                data: [openCount, deliveredCount],
                backgroundColor: ['#e84118', '#44bd32']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function generateRequestTimelineChart() {
    const canvas = document.getElementById('requestTimelineChart');
    if (!canvas) return;
    
    if (chartInstances.requestTimeline) {
        chartInstances.requestTimeline.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    const days = [];
    const openCounts = [];
    const deliveredCounts = [];
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        const requestsOnDay = allRequests.filter(r => {
            const reqDate = new Date(r.request_date).toISOString().split('T')[0];
            return reqDate === dateStr;
        });
        
        openCounts.push(requestsOnDay.filter(r => r.status === 'open').length);
        deliveredCounts.push(requestsOnDay.filter(r => r.status === 'delivered').length);
    }
    
    chartInstances.requestTimeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Open',
                    data: openCounts,
                    borderColor: '#e84118',
                    backgroundColor: 'rgba(232, 65, 24, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Delivered',
                    data: deliveredCounts,
                    borderColor: '#44bd32',
                    backgroundColor: 'rgba(68, 189, 50, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function generateRequestTypeChart() {
    const canvas = document.getElementById('requestTypeChart');
    if (!canvas) return;
    
    if (chartInstances.requestType) {
        chartInstances.requestType.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    const stationCount = allRequests.filter(r => r.request_type === 'station').length;
    const partCount = allRequests.filter(r => r.request_type === 'part').length;
    const fastenerCount = allRequests.filter(r => r.fastener === true).length;
    
    chartInstances.requestType = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Station Requests', 'Part Requests', 'Fasteners'],
            datasets: [{
                data: [stationCount, partCount, fastenerCount],
                backgroundColor: ['#00a8ff', '#f39c12', '#9c88ff']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

// ==================== EXPORT FUNCTIONS ====================

function exportRequestsToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const dataToExport = filteredRequests.length > 0 ? filteredRequests : allRequests;
        
        doc.setFontSize(18);
        doc.text('Assembly Production - Requests Report', 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`By: ${currentUser.username}`, 14, 34);
        
        const filterStatus = document.getElementById('filterStatus').value || 'All';
        const filterType = document.getElementById('filterReqType').value || 'All';
        const filterVehicle = document.getElementById('filterVehicleType').value || 'All';
        const filterFastener = document.getElementById('filterFastener')?.value || 'All';
        
        doc.text(`Filters: Status=${filterStatus}, Type=${filterType}, Vehicle=${filterVehicle}, Fastener=${filterFastener}`, 14, 40);
        doc.text(`Total Records: ${dataToExport.length}`, 14, 46);
        
        const tableData = dataToExport.map(r => [
            r.vehicle_number,
            r.station_code,
            r.request_type,
            r.part_number || '-',
            r.qty || '-',
            r.fastener ? 'Yes' : 'No',
            r.status,
            r.requested_by,
            formatDate(r.request_date)
        ]);
        
        doc.autoTable({
            startY: 52,
            head: [['Vehicle', 'Station', 'Type', 'Part #', 'Qty', 'Fastener', 'Status', 'By', 'Date']],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 168, 255] }
        });
        
        doc.save(`requests-report-${new Date().toISOString().split('T')[0]}.pdf`);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

function exportRequestsToExcel() {
    try {
        const wb = XLSX.utils.book_new();
        
        const requestsData = allRequests.map(r => ({
            'Vehicle Number': r.vehicle_number,
            'Vehicle Type': r.vehicle_type,
            'Station': r.station_code,
            'Request Type': r.request_type,
            'Part Number': r.part_number || '',
            'Quantity': r.qty || '',
            'Fastener': r.fastener ? 'Yes' : 'No',
            'Status': r.status,
            'Requested By': r.requested_by,
            'Request Date': formatDate(r.request_date),
            'Delivery Date': formatDate(r.delivery_date)
        }));
        
        const ws1 = XLSX.utils.json_to_sheet(requestsData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Requests');
        
        const vehiclesData = allVehicles.map(v => {
            const status = allProductionStatus.filter(s => s.vehicle_number === v.vehicle_number);
            const completed = status.filter(s => s.status === 'completed').length;
            const total = status.length;
            
            return {
                'Vehicle Number': v.vehicle_number,
                'Type': v.vehicle_type,
                'Total Stations': total,
                'Completed': completed,
                'Progress %': total > 0 ? Math.round((completed / total) * 100) : 0,
                'Created': formatDate(v.created_at)
            };
        });
        
        const ws2 = XLSX.utils.json_to_sheet(vehiclesData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Vehicles');
        
        const prodData = allProductionStatus.map(s => ({
            'Vehicle Number': s.vehicle_number,
            'Station': s.station_code,
            'Status': s.status,
            'Last Updated': formatDate(s.updated_at)
        }));
        
        const ws3 = XLSX.utils.json_to_sheet(prodData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Production Status');
        
        XLSX.writeFile(wb, `production-data-${new Date().toISOString().split('T')[0]}.xlsx`);
        
    } catch (error) {
        console.error('Error generating Excel:', error);
        alert('Failed to generate Excel file. Please try again.');
    }
}

function exportAnalyticsToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('Assembly Production Analytics Report', 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`By: ${currentUser.username}`, 14, 36);
        
        doc.setFontSize(14);
        doc.text('Summary Statistics', 14, 46);
        
        doc.setFontSize(10);
        const stats = [
            `Total Vehicles: ${allVehicles.length}`,
            `Completed Stations: ${allProductionStatus.filter(s => s.status === 'completed').length}`,
            `Pending Stations: ${allProductionStatus.filter(s => s.status === 'pending').length}`,
            `Open Requests: ${allRequests.filter(r => r.status === 'open').length}`,
            `Delivered Requests: ${allRequests.filter(r => r.status === 'delivered').length}`
        ];
        
        let yPos = 54;
        stats.forEach(stat => {
            doc.text(stat, 14, yPos);
            yPos += 6;
        });
        
        yPos += 8;
        doc.setFontSize(14);
        doc.text('Vehicle Breakdown', 14, yPos);
        
        yPos += 8;
        doc.setFontSize(10);
        
        const vehicleTableData = [];
        ['K9', 'K10', 'K11'].forEach(type => {
            const vehicles = allVehicles.filter(v => v.vehicle_type === type);
            const vehicleNums = vehicles.map(v => v.vehicle_number);
            const status = allProductionStatus.filter(s => vehicleNums.includes(s.vehicle_number));
            const completed = status.filter(s => s.status === 'completed').length;
            const total = status.length;
            
            vehicleTableData.push([
                type,
                vehicles.length,
                total,
                completed,
                total - completed,
                total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%'
            ]);
        });
        
        doc.autoTable({
            startY: yPos,
            head: [['Type', 'Vehicles', 'Stations', 'Completed', 'Pending', 'Progress']],
            body: vehicleTableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [0, 168, 255] }
        });
        
        yPos = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(14);
        doc.text('Request Statistics', 14, yPos);
        
        yPos += 8;
        const requestTableData = [
            ['Station Requests', allRequests.filter(r => r.request_type === 'station').length],
            ['Part Requests', allRequests.filter(r => r.request_type === 'part').length],
            ['Fastener Requests', allRequests.filter(r => r.fastener === true).length],
            ['Open Requests', allRequests.filter(r => r.status === 'open').length],
            ['Delivered Requests', allRequests.filter(r => r.status === 'delivered').length]
        ];
        
        doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count']],
            body: requestTableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [0, 168, 255] }
        });
        
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
        }
        
        doc.save(`analytics-report-${new Date().toISOString().split('T')[0]}.pdf`);
        
    } catch (error) {
        console.error('Error generating analytics PDF:', error);
        alert('Failed to generate analytics report. Please try again.');
    }
}

// ==================== TAB SWITCHING ====================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(`${tabName}Tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    if (tabName === 'analytics') {
        setTimeout(generateCharts, 100);
    }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            login();
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    const reqVehicleType = document.getElementById('reqVehicleType');
    if (reqVehicleType) {
        reqVehicleType.addEventListener('change', () => {
            populateVehicleNumbers();
            populateStations();
        });
    }
    
    const reqType = document.getElementById('reqType');
    if (reqType) {
        reqType.addEventListener('change', (e) => {
            const partFields = document.getElementById('partFields');
            if (partFields) {
                partFields.style.display = e.target.value === 'part' ? 'grid' : 'none';
            }
        });
    }
    
    const createRequestBtn = document.getElementById('createRequestBtn');
    if (createRequestBtn) {
        createRequestBtn.addEventListener('click', createRequest);
    }
    
    const addVehicleBtn = document.getElementById('addVehicleBtn');
    if (addVehicleBtn) {
        addVehicleBtn.addEventListener('click', createVehicle);
    }
    
    const filterStatus = document.getElementById('filterStatus');
    const filterReqType = document.getElementById('filterReqType');
    const filterVehicleType = document.getElementById('filterVehicleType');
    const filterFastener = document.getElementById('filterFastener');
    const searchRequest = document.getElementById('searchRequest');
    
    if (filterStatus) filterStatus.addEventListener('change', applyRequestFilters);
    if (filterReqType) filterReqType.addEventListener('change', applyRequestFilters);
    if (filterVehicleType) filterVehicleType.addEventListener('change', applyRequestFilters);
    if (filterFastener) filterFastener.addEventListener('change', applyRequestFilters);
    if (searchRequest) searchRequest.addEventListener('input', debounce(applyRequestFilters, 300));
    
    const totalVehiclesCard = document.getElementById('totalVehicles')?.parentElement?.parentElement;
    const completedStationsCard = document.getElementById('completedStations')?.parentElement?.parentElement;
    const pendingStationsCard = document.getElementById('pendingStations')?.parentElement?.parentElement;
    const openRequestsCard = document.getElementById('openRequests')?.parentElement?.parentElement;
    
    if (totalVehiclesCard && !totalVehiclesCard.dataset.listenerAttached) {
        totalVehiclesCard.style.cursor = 'pointer';
        totalVehiclesCard.addEventListener('click', (e) => {
            e.stopPropagation();
            showVehiclesDetail();
        });
        totalVehiclesCard.dataset.listenerAttached = 'true';
    }
    if (completedStationsCard && !completedStationsCard.dataset.listenerAttached) {
        completedStationsCard.style.cursor = 'pointer';
        completedStationsCard.addEventListener('click', (e) => {
            e.stopPropagation();
            showCompletedStationsDetail();
        });
        completedStationsCard.dataset.listenerAttached = 'true';
    }
    if (pendingStationsCard && !pendingStationsCard.dataset.listenerAttached) {
        pendingStationsCard.style.cursor = 'pointer';
        pendingStationsCard.addEventListener('click', (e) => {
            e.stopPropagation();
            showPendingStationsDetail();
        });
        pendingStationsCard.dataset.listenerAttached = 'true';
    }
    if (openRequestsCard && !openRequestsCard.dataset.listenerAttached) {
        openRequestsCard.style.cursor = 'pointer';
        openRequestsCard.addEventListener('click', (e) => {
            e.stopPropagation();
            showOpenRequestsDetail();
        });
        openRequestsCard.dataset.listenerAttached = 'true';
    }
    
    const filterProdVehicle = document.getElementById('filterProdVehicle');
    const filterProdStatus = document.getElementById('filterProdStatus');
    
    if (filterProdVehicle) filterProdVehicle.addEventListener('change', applyProductionFilters);
    if (filterProdStatus) filterProdStatus.addEventListener('change', applyProductionFilters);
    
    const filterVehicles = document.getElementById('filterVehicles');
    if (filterVehicles) filterVehicles.addEventListener('change', applyVehicleFilters);
    
    const exportRequestsPDF = document.getElementById('exportRequestsPDF');
    const exportRequestsExcel = document.getElementById('exportRequestsExcel');
    const exportAnalyticsPDF = document.getElementById('exportAnalyticsPDF');
    
    if (exportRequestsPDF) exportRequestsPDF.addEventListener('click', exportRequestsToPDF);
    if (exportRequestsExcel) exportRequestsExcel.addEventListener('click', exportRequestsToExcel);
    if (exportAnalyticsPDF) exportAnalyticsPDF.addEventListener('click', exportAnalyticsToPDF);
    
    const showAddUserBtn = document.getElementById('showAddUserBtn');
    const addUserBtn = document.getElementById('addUserBtn');
    const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    
    if (showAddUserBtn) {
        showAddUserBtn.addEventListener('click', () => {
            const form = document.getElementById('addUserForm');
            if (form) {
                form.style.display = form.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
    
    if (addUserBtn) addUserBtn.addEventListener('click', createUser);
    
    if (cancelAddUserBtn) {
        cancelAddUserBtn.addEventListener('click', () => {
            const form = document.getElementById('addUserForm');
            if (form) form.style.display = 'none';
        });
    }
}

// ==================== INITIALIZATION ====================

async function refreshDashboard() {
    try {
        await Promise.all([
            fetchRequests(),
            fetchVehicles(),
            fetchProductionStatus(),
            currentUser.role === 'master_admin' ? fetchUsers() : Promise.resolve()
        ]);
        
        updateSummaryCards();
        renderRequestsTable();
        renderProductionTable();
        renderVehiclesTable();
        populateProductionVehicleFilter();
        
        if (currentUser.role === 'master_admin') {
            renderUsersTable();
        }
        
        applyRequestFilters();
        applyProductionFilters();
        applyVehicleFilters();
        
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
    }
}

async function initDashboard() {
    if (!checkAuth()) return;
    
    try {
        console.log('Loading dashboard...');
        
        await fetchTelegramConfig();
        
        await refreshDashboard();
        
        setupEventListeners();
        
        const analyticsTab = document.getElementById('analyticsTab');
        if (analyticsTab && analyticsTab.classList.contains('active')) {
            generateCharts();
        }
        
        console.log('Dashboard loaded successfully');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('Failed to load dashboard. Please refresh the page.');
    }
}

function initLogin() {
    if (checkAuth()) return;
    
    setupEventListeners();
    
    const usernameField = document.getElementById('username');
    if (usernameField) {
        usernameField.focus();
    }
}

// ==================== PAGE LOAD ====================

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('login.html')) {
        initLogin();
    } else if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
        initDashboard();
    }
});

// ==================== GLOBAL ERROR HANDLER ====================

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ==================== END OF APP.JS ====================
console.log('Assembly Production System v2.0 - Application loaded with Audit Logging & Telegram Integration');