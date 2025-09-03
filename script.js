// 个人成长追踪器 - 主要JavaScript文件

class PersonalGrowthTracker {
    constructor() {
        this.currentCategory = '学习';
        this.currentOutlineView = 'list'; // 'list' or 'mindmap'
        this.currentTodoView = 'list';
        this.currentTomorrowView = 'list';
        this.historyFilter = 'today'; // 'today', 'yesterday', 'all'
        this.exportDateRange = 'all'; // 'today', 'yesterday', 'week', 'all', 'custom'
        
        // 分类图标映射
        this.categoryIcons = {
            '学习': 'fa-book',
            '健康': 'fa-heart',
            '工作': 'fa-briefcase'
        };
        
        // 数据结构 - 修复：为明日待办添加独立存储
        this.data = {
            categories: ['学习', '健康', '工作'],
            outlines: {},
            todos: [],
            tomorrowTodos: [], // 新增：明日待办独立存储
            history: [],
            stats: {
                streakDays: 0,
                todayCompleted: 0,
                totalCompleted: 0,
                lastActiveDate: null,
                dailyResetTime: '00:00' // 新增：日期刷新时间设置
            }
        };
        
        this.init();
    }

    init() {
        // 数据管理
        this.loadData();
        this.bindEvents();
        this.updateStats();
        this.renderAll();
        this.checkDailyReset();
        
        // 设置自动日期检查机制
        this.setupDailyResetTimer();
        
        // 页面可见性变化时检查日期
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkDailyReset();
                this.renderAll();
            }
        });
    }

    // 数据管理
    loadData() {
        const savedData = localStorage.getItem('personalGrowthTracker');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                this.data = { ...this.data, ...parsedData };
                
                // 检查是否有异常的模态框状态被保存
                if (parsedData.showingModal) {
                    delete this.data.showingModal;
                }
                
                // 数据迁移：为现有待办添加缺失的日期字段
                this.migrateExistingData();
                
            } catch (e) {
                console.error('解析保存数据失败:', e);
                // 如果数据损坏，清除localStorage
                localStorage.removeItem('personalGrowthTracker');
            }
        }
        
        // 确保每个分类都有大纲数据
        this.data.categories.forEach(category => {
            if (!this.data.outlines[category]) {
                this.data.outlines[category] = [];
            }
        });
        
        // 确保明日待办数组存在
        if (!this.data.tomorrowTodos) {
            this.data.tomorrowTodos = [];
        }
        
        // 页面加载时清理所有可能存在的模态框
        setTimeout(() => {
            const modals = document.querySelectorAll('.fullscreen-modal');
            modals.forEach(modal => modal.remove());
        }, 0);
    }
    
    // 数据迁移：为现有数据添加新字段
    migrateExistingData() {
        const today = new Date().toISOString().split('T')[0];
        
        // 迁移今日待办数据
        this.data.todos.forEach(todo => {
            if (!todo.createdDate) {
                // 如果没有创建日期，使用createdAt推算或默认为今天
                if (todo.createdAt) {
                    todo.createdDate = new Date(todo.createdAt).toISOString().split('T')[0];
                } else {
                    todo.createdDate = today;
                }
            }
            if (!todo.targetDate) {
                todo.targetDate = todo.createdDate; // 默认目标日期等于创建日期
            }
            if (!todo.hasOwnProperty('completedDate')) {
                todo.completedDate = todo.completed && todo.completedAt ? 
                    new Date(todo.completedAt).toISOString().split('T')[0] : null;
            }
            if (!todo.hasOwnProperty('isOverdue')) {
                todo.isOverdue = todo.completed && todo.completedDate && todo.targetDate < todo.completedDate;
            }
        });
        
        // 迁移明日待办数据
        this.data.tomorrowTodos.forEach(todo => {
            if (!todo.createdDate) {
                if (todo.createdAt) {
                    todo.createdDate = new Date(todo.createdAt).toISOString().split('T')[0];
                } else {
                    todo.createdDate = today;
                }
            }
            if (!todo.targetDate) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                todo.targetDate = tomorrow.toISOString().split('T')[0];
            }
            if (!todo.hasOwnProperty('completedDate')) {
                todo.completedDate = todo.completed && todo.completedAt ? 
                    new Date(todo.completedAt).toISOString().split('T')[0] : null;
            }
            if (!todo.hasOwnProperty('isOverdue')) {
                todo.isOverdue = false; // 明日待办默认不逾期
            }
        });
        
        // 迁移历史记录数据
        this.data.history.forEach(item => {
            if (!item.createdDate) {
                item.createdDate = new Date(item.timestamp).toISOString().split('T')[0];
            }
            if (!item.completedDate) {
                item.completedDate = new Date(item.timestamp).toISOString().split('T')[0];
            }
            if (!item.hasOwnProperty('isOverdue')) {
                item.isOverdue = false; // 历史记录默认不逾期
            }
        });
    }

    saveData() {
        localStorage.setItem('personalGrowthTracker', JSON.stringify(this.data));
    }

    // 检查日期重置 - 改为00:00精确切换
    checkDailyReset() {
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD格式
        const lastDate = this.data.stats.lastActiveDate;
        
        if (lastDate && lastDate !== today) {
            // 处理跨日期的待办事项
            this.processOverdueTodos();
            
            // 检查是否连续
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (lastDate !== yesterdayStr) {
                this.data.stats.streakDays = 0;
            }
            
            this.data.stats.todayCompleted = 0;
        }
        
        this.data.stats.lastActiveDate = today;
        this.saveData();
        
        // 清理可能存在的模态框
        const existingModal = document.querySelector('.fullscreen-modal');
        if (existingModal) {
            existingModal.remove();
        }
    }
    
    // 设置自动日期检查定时器
    setupDailyResetTimer() {
        // 计算到下一个午夜的毫秒数
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        // 设置到午夜的定时器
        setTimeout(() => {
            this.checkDailyReset();
            this.renderAll();
            
            // 之后每24小时检查一次
            setInterval(() => {
                this.checkDailyReset();
                this.renderAll();
            }, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
        
        // 每小时也检查一次，防止系统时间变化
        setInterval(() => {
            this.checkDailyReset();
        }, 60 * 60 * 1000);
    }
    
    // 处理逾期待办事项
    processOverdueTodos() {
        const today = new Date().toISOString().split('T')[0];
        
        this.data.todos.forEach(todo => {
            if (!todo.completed && todo.targetDate < today) {
                todo.isOverdue = true;
            }
        });
        
        this.data.tomorrowTodos.forEach(todo => {
            if (!todo.completed && todo.targetDate < today) {
                todo.isOverdue = true;
            }
        });
    }

    // 事件绑定
    bindEvents() {
        // 分类标签切换
        document.querySelectorAll('.tab-btn[data-category]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchCategory(e.target.dataset.category);
            });
        });

        // 添加分类
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.showModal('添加分类', '', (value) => {
                this.addCategory(value);
            });
        });

        // 大纲相关按钮 - 修复：正确传递分类参数
        document.getElementById('addOutlineBtn').addEventListener('click', () => {
            this.showModal('添加大纲项目', '', (value, category, outlineItem, syncToTodo) => {
                this.addOutlineItem(value, null, 1, syncToTodo, category);
            }, true, false, true);
        });

        document.getElementById('outlineViewToggle').addEventListener('click', () => {
            this.toggleOutlineView();
        });


        // 延迟绑定全分类视图按钮事件
        setTimeout(() => {
            const outlineBtn = document.getElementById('outlineAllCategoriesBtn');
            if (outlineBtn) {
                outlineBtn.addEventListener('click', () => {
                    console.log('Outline all categories button clicked');
                    this.showAllCategoriesView('outline');
                });
            }
        }, 100);

        // 今日待办相关按钮 - 修复：正确传递分类参数
        document.getElementById('addTodoBtn').addEventListener('click', () => {
            this.showModal('添加今日待办', '', (value, category, outlineItem, syncToTodo) => {
                let outlineId = null;
                if (outlineItem && outlineItem !== '') {
                    try {
                        const outlineRef = JSON.parse(outlineItem);
                        outlineId = outlineRef.id;
                    } catch (e) {
                        console.error('解析大纲项目失败:', e);
                    }
                }
                this.addTodoItem(value, category, outlineId);
            }, true, true);
        });

        document.getElementById('todoViewToggle').addEventListener('click', () => {
            this.toggleTodoView();
        });


        // 延迟绑定全分类视图按钮事件
        setTimeout(() => {
            const todoBtn = document.getElementById('todoAllCategoriesBtn');
            if (todoBtn) {
                todoBtn.addEventListener('click', () => {
                    console.log('Todo all categories button clicked');
                    this.showAllCategoriesView('todo');
                });
            }
        }, 100);

        // 明日待办相关按钮 - 新增功能
        document.getElementById('addTomorrowTodoBtn').addEventListener('click', () => {
            this.showModal('添加明日待办', '', (value, category, outlineItem, syncToTodo) => {
                let outlineId = null;
                if (outlineItem && outlineItem !== '') {
                    try {
                        const outlineRef = JSON.parse(outlineItem);
                        outlineId = outlineRef.id;
                    } catch (e) {
                        console.error('解析大纲项目失败:', e);
                    }
                }
                const isLocked = document.getElementById('lockTodoCheckbox').checked;
                this.addTomorrowTodoItem(value, category, outlineId, isLocked);
            }, true, true);
        });

        document.getElementById('tomorrowViewToggle').addEventListener('click', () => {
            this.toggleTomorrowView();
        });


        // 延迟绑定全分类视图按钮事件
        setTimeout(() => {
            const tomorrowBtn = document.getElementById('tomorrowAllCategoriesBtn');
            if (tomorrowBtn) {
                tomorrowBtn.addEventListener('click', () => {
                    console.log('Tomorrow all categories button clicked');
                    this.showAllCategoriesView('tomorrow');
                });
            }
        }, 100);

        document.getElementById('transferTodosBtn').addEventListener('click', () => {
            this.transferTomorrowTodosToToday();
        });
        
        // 分类选择变化时更新大纲选项
        document.addEventListener('change', (e) => {
            if (e.target.id === 'categorySelect') {
                this.updateOutlineSelect();
            }
        });
        
        // 历史记录过滤器
        document.getElementById('historyTodayBtn').addEventListener('click', () => {
            this.setHistoryFilter('today');
        });
        
        document.getElementById('historyYesterdayBtn').addEventListener('click', () => {
            this.setHistoryFilter('yesterday');
        });
        
        document.getElementById('historyAllBtn').addEventListener('click', () => {
            this.setHistoryFilter('all');
        });
        
        // 导出功能
        document.getElementById('exportBtn').addEventListener('click', (e) => {
            this.initExportMenu();
            this.toggleExportMenu();
            e.stopPropagation();
        });

        // 清空历史
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
                this.data.history = [];
                this.saveData();
                this.renderHistory();
            }
        });

        // 模态框事件
        this.bindModalEvents();

        // 点击外部关闭导出菜单
        document.addEventListener('click', (e) => {
            const exportMenu = document.getElementById('exportMenu');
            const exportBtn = document.getElementById('exportBtn');
            
            // 如果点击的是日期输入框或其内部元素，不关闭菜单
            if (e.target.type === 'date' || e.target.closest('input[type="date"]')) {
                return;
            }
            
            // 如果点击的是导出菜单内部元素，不关闭菜单
            if (exportMenu && exportMenu.contains(e.target)) {
                return;
            }
            
            // 如果点击的是导出按钮，不关闭菜单（由按钮自己控制）
            if (exportBtn && exportBtn.contains(e.target)) {
                return;
            }
            
            // 其他情况关闭菜单
            if (exportMenu) {
                exportMenu.style.display = 'none';
            }
        });
    }

    bindModalEvents() {
        const modal = document.getElementById('itemModal');
        const modalClose = document.querySelector('.modal-close');
        const modalCancel = document.getElementById('itemCancel');
        const modalConfirm = document.getElementById('itemConfirm');
        const modalInput = document.getElementById('itemInput');

        modalClose.addEventListener('click', () => this.hideModal());
        modalCancel.addEventListener('click', () => this.hideModal());
        
        modalConfirm.addEventListener('click', () => {
            const value = modalInput.value.trim();
            const category = document.getElementById('categorySelect').value;
            const outlineItem = document.getElementById('outlineSelect').value;
            const syncToTodo = document.getElementById('syncToTodo').checked;
            
            if (value && this.currentModalCallback) {
                this.currentModalCallback(value, category, outlineItem, syncToTodo);
                this.hideModal();
            }
        });

        modalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                modalConfirm.click();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal();
            }
        });

        // 全屏模态框事件
        const fullscreenClose = document.getElementById('fullscreenClose');
        if (fullscreenClose) {
            fullscreenClose.addEventListener('click', () => {
                this.hideFullscreenMindMap();
            });
        }
    }

    // 模态框管理
    showModal(title, placeholder, callback, showCategorySelect = false, showOutlineSelect = false, showSyncOption = false) {
        const modal = document.getElementById('itemModal');
        const modalTitle = document.getElementById('modalTitle');
        const itemInput = document.getElementById('itemInput');
        const categorySelect = document.getElementById('categorySelect');
        const outlineSelect = document.getElementById('outlineSelect');
        const syncToTodoCheckbox = document.getElementById('syncToTodo');
        const lockTodoCheckbox = document.getElementById('lockTodoCheckbox');
        
        modalTitle.textContent = title;
        itemInput.placeholder = placeholder;
        itemInput.value = '';
        
        // 显示/隐藏分类选择
        if (showCategorySelect) {
            categorySelect.style.display = 'block';
            this.updateCategorySelect();
        } else {
            categorySelect.style.display = 'none';
        }
        
        // 显示/隐藏大纲选择框
        if (showOutlineSelect) {
            outlineSelect.style.display = 'block';
            this.updateOutlineSelect();
        } else {
            outlineSelect.style.display = 'none';
        }
        
        // 显示/隐藏同步到待办选项
        if (showSyncOption || title.includes('大纲')) {
            document.getElementById('syncToTodoContainer').style.display = 'block';
        } else {
            document.getElementById('syncToTodoContainer').style.display = 'none';
        }
        
        // 显示/隐藏锁定待办选项（仅对明日待办显示）
        if (title.includes('明日待办')) {
            document.getElementById('lockTodoContainer').style.display = 'block';
            document.getElementById('lockTodoCheckbox').checked = false;
        } else {
            document.getElementById('lockTodoContainer').style.display = 'none';
        }
        
        modal.style.display = 'block';
        itemInput.focus();
        
        // 保存回调函数
        this.currentModalCallback = callback;
    }

    hideModal() {
        const modal = document.getElementById('itemModal');
        modal.style.display = 'none';
        this.currentModalCallback = null;
    }

    updateCategorySelect() {
        const select = document.getElementById('categorySelect');
        select.innerHTML = '';
        
        this.data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
    }

    updateOutlineSelect() {
        const select = document.getElementById('outlineSelect');
        const categorySelect = document.getElementById('categorySelect');
        const currentCategory = categorySelect ? categorySelect.value : this.currentCategory;
        
        if (!select) return;
        
        select.innerHTML = '<option value="">选择大纲项目（可选）</option>';
        
        // 只显示当前选中分类的大纲项目
        const items = this.data.outlines[currentCategory] || [];
        if (items.length > 0) {
            this.addOutlineOptionsRecursive(items, select, '');
        }
    }

    addOutlineOptionsRecursive(items, parent, prefix) {
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = JSON.stringify({id: item.id, text: item.text, category: this.getCategoryByItem(item.id)});
            option.textContent = prefix + item.text;
            parent.appendChild(option);
            
            if (item.children && item.children.length > 0) {
                this.addOutlineOptionsRecursive(item.children, parent, prefix + '  ');
            }
        });
    }

    getCategoryByItem(itemId) {
        for (let category of this.data.categories) {
            if (this.findOutlineItemInCategory(itemId, category)) {
                return category;
            }
        }
        return null;
    }

    findOutlineItemInCategory(id, category) {
        const items = this.data.outlines[category] || [];
        return this.findOutlineItemRecursive(id, items);
    }

    findOutlineItemRecursive(id, items) {
        for (let item of items) {
            if (item.id === id) {
                return item;
            }
            const found = this.findOutlineItemRecursive(id, item.children);
            if (found) {
                return found;
            }
        }
        return null;
    }

    // 分类管理
    switchCategory(category) {
        this.currentCategory = category;
        
        // 更新标签样式
        document.querySelectorAll('.tab-btn[data-category]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.renderOutlines();
        this.renderTodos();
        this.renderTomorrowTodos();
        
        // 如果当前是思维导图视图，也需要更新思维导图
        if (this.currentOutlineView === 'mindmap') {
            this.renderOutlineMindMap();
        }
        if (this.currentTodoView === 'mindmap') {
            this.renderTodoMindMap();
        }
        if (this.currentTomorrowView === 'mindmap') {
            this.renderTomorrowTodoMindMap();
        }
    }

    addCategory(name) {
        if (name && !this.data.categories.includes(name)) {
            this.data.categories.push(name);
            this.data.outlines[name] = [];
            this.saveData();
            this.renderCategoryTabs();
        }
    }

    removeCategory(name) {
        if (this.data.categories.length > 1) {
            const index = this.data.categories.indexOf(name);
            if (index > -1) {
                this.data.categories.splice(index, 1);
                delete this.data.outlines[name];
                
                if (this.currentCategory === name) {
                    this.currentCategory = this.data.categories[0];
                }
                
                this.saveData();
                this.renderCategoryTabs();
                this.renderOutlines();
                this.renderTodos();
                this.renderTomorrowTodos();
            }
        }
    }

    // 大纲管理 - 修复：支持指定分类添加
    addOutlineItem(text, parentId = null, level = 1, syncToTodo = false, targetCategory = null) {
        const category = targetCategory || this.currentCategory;
        const item = {
            id: Date.now() + Math.random(),
            text: text,
            parentId: parentId,
            level: level,
            expanded: true,
            children: []
        };

        if (!this.data.outlines[category]) {
            this.data.outlines[category] = [];
        }

        if (parentId) {
            const parent = this.findOutlineItemInCategory(parentId, category);
            if (parent) {
                parent.children.push(item);
                item.level = parent.level + 1;
            }
        } else {
            this.data.outlines[category].push(item);
        }

        // 如果选择同步到待办，自动创建待办事项
        if (syncToTodo) {
            this.addTodoItem(text, category, item.id);
        }

        this.saveData();
        this.renderOutlines();
    }


    removeOutlineItem(id) {
        this.removeFromOutlineArray(this.data.outlines[this.currentCategory], id);
        this.saveData();
        this.renderOutlines();
    }

    removeFromOutlineArray(items, id) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                items.splice(i, 1);
                return true;
            }
            if (this.removeFromOutlineArray(items[i].children, id)) {
                return true;
            }
        }
        return false;
    }

    toggleOutlineExpand(id) {
        const item = this.findOutlineItem(id);
        if (item) {
            item.expanded = !item.expanded;
            this.saveData();
            this.renderOutlines();
        }
    }

    // 今日待办管理
    addTodoItem(text, category = null, outlineId = null, isLocked = false) {
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD格式
        
        const todo = {
            id: Date.now() + Math.random(),
            text: text,
            completed: false,
            category: category || this.currentCategory,
            createdAt: new Date().toISOString(),
            createdDate: today,
            targetDate: today,
            completedDate: null,
            isOverdue: false,
            outlineItem: outlineId,
            isLocked: false
        };
        
        this.data.todos.push(todo);
        this.saveData();
        this.renderTodos();
        this.updateStats();
    }

    toggleTodoComplete(id) {
        const todo = this.data.todos.find(t => t.id === id);
        if (todo) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            todo.completed = !todo.completed;
            todo.completedAt = todo.completed ? new Date().toISOString() : null;
            todo.completedDate = todo.completed ? today : null;
            
            // 检查是否逾期
            if (todo.completed && todo.targetDate < today) {
                todo.isOverdue = true;
            }

            if (todo.completed) {
                this.data.stats.todayCompleted++;
                this.data.stats.totalCompleted++;
                
                // 添加到历史记录 - 按创建日期归属
                this.data.history.push({
                    text: todo.text,
                    category: todo.category,
                    type: 'todo',
                    timestamp: new Date().toISOString(),
                    createdDate: todo.createdDate,
                    completedDate: todo.completedDate,
                    isOverdue: todo.isOverdue,
                    outlineRef: todo.outlineRef
                });
            } else {
                this.data.stats.todayCompleted--;
                this.data.stats.totalCompleted--;
                
                // 从历史记录中移除
                this.data.history = this.data.history.filter(h => 
                    !(h.text === todo.text && h.category === todo.category && h.type === 'todo')
                );
            }
            
            this.saveData();
            this.renderTodos();
            this.renderHistory();
            this.updateStats();
        }
    }

    removeTodoItem(id) {
        const index = this.data.todos.findIndex(t => t.id === id);
        if (index > -1) {
            const todo = this.data.todos[index];
            if (todo.completed) {
                this.data.stats.todayCompleted = Math.max(0, this.data.stats.todayCompleted - 1);
                this.data.stats.totalCompleted = Math.max(0, this.data.stats.totalCompleted - 1);
            }
            
            this.data.todos.splice(index, 1);
            this.saveData();
            this.renderTodos();
            this.updateStats();
        }
    }

    // 明日待办管理 - 新增功能
    addTomorrowTodoItem(text, category, outlineId, isLocked = false) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const todo = {
            id: Date.now() + Math.random(),
            text: text,
            category: category,
            completed: false,
            createdAt: new Date().toISOString(),
            createdDate: now.toISOString().split('T')[0],
            targetDate: tomorrowStr,
            completedDate: null,
            isOverdue: false,
            outlineItem: outlineId,
            isLocked: isLocked
        };
        
        this.data.tomorrowTodos.push(todo);
        this.saveData();
        this.renderTomorrowTodos();
    }

    toggleTomorrowTodoComplete(id) {
        const todo = this.data.tomorrowTodos.find(t => t.id === id);
        if (todo) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            todo.completed = !todo.completed;
            todo.completedAt = todo.completed ? new Date().toISOString() : null;
            todo.completedDate = todo.completed ? today : null;
            
            // 检查是否逾期
            if (todo.completed && todo.targetDate < today) {
                todo.isOverdue = true;
            }

            if (todo.completed) {
                this.data.stats.todayCompleted++;
                this.data.stats.totalCompleted++;
                
                // 添加到历史记录 - 按创建日期归属
                this.data.history.push({
                    text: todo.text,
                    category: todo.category,
                    type: 'tomorrow',
                    timestamp: new Date().toISOString(),
                    createdDate: todo.createdDate,
                    completedDate: todo.completedDate,
                    isOverdue: todo.isOverdue,
                    outlineRef: todo.outlineRef
                });
            } else {
                this.data.stats.todayCompleted--;
                this.data.stats.totalCompleted--;
                
                // 从历史记录中移除
                this.data.history = this.data.history.filter(h => 
                    !(h.text === todo.text && h.category === todo.category && h.type === 'tomorrow')
                );
            }
            
            this.saveData();
            this.renderTomorrowTodos();
            this.renderHistory();
            this.updateStats();
        }
    }

    removeTomorrowTodoItem(id) {
        const index = this.data.tomorrowTodos.findIndex(t => t.id === id);
        if (index > -1) {
            this.data.tomorrowTodos.splice(index, 1);
            this.saveData();
            this.renderTomorrowTodos();
        }
    }

    transferTomorrowTodosToToday() {
        if (this.data.tomorrowTodos.length === 0) {
            alert('暂无明日待办需要转换！');
            return;
        }

        const todosToTransfer = [...this.data.tomorrowTodos];
        
        todosToTransfer.forEach(todo => {
            // 添加到今日待办，保持原有的创建日期
            const newTodo = {
                ...todo,
                id: Date.now() + Math.random() + Math.random(),
                createdAt: new Date().toISOString(),
                targetDate: new Date().toISOString().split('T')[0], // 更新目标日期为今天
                completed: false
            };
            this.data.todos.push(newTodo);
        });
        
        // 只移除非锁定的待办，锁定的待办保留并重置状态
        this.data.tomorrowTodos = this.data.tomorrowTodos.filter(todo => {
            if (todo.isLocked) {
                todo.completed = false;
                return true;
            }
            return false;
        });
        
        this.saveData();
        this.renderTodos();
        this.renderTomorrowTodos();
        this.updateStats();
        alert('明日待办已成功转换为今日待办！');
    }

    transferSingleTodoToToday(id) {
        const todoIndex = this.data.tomorrowTodos.findIndex(t => t.id === id);
        if (todoIndex > -1) {
            const todo = this.data.tomorrowTodos[todoIndex];
            const newTodo = {
                ...todo,
                id: Date.now() + Math.random(),
                createdAt: new Date().toISOString()
            };
            
            this.data.todos.push(newTodo);
            this.data.tomorrowTodos.splice(todoIndex, 1);
            
            this.saveData();
            this.renderTodos();
            this.renderTomorrowTodos();
        }
    }

    // 历史记录
    addToHistory(text, type) {
        const item = {
            id: Date.now() + Math.random(),
            text: text,
            type: type,
            timestamp: new Date().toISOString()
        };

        this.data.history.unshift(item);
        
        // 限制历史记录数量
        if (this.data.history.length > 100) {
            this.data.history = this.data.history.slice(0, 100);
        }

        this.saveData();
        this.renderHistory();
    }

    // 渲染方法
    renderAll() {
        this.renderCategoryTabs();
        this.renderOutlines();
        this.renderTodos();
        this.renderTomorrowTodos();
        this.renderHistory();
    }

    renderCategoryTabs() {
        const container = document.querySelector('.category-tabs');
        const addBtn = document.getElementById('addCategoryBtn');
        
        // 清除现有的分类按钮
        container.querySelectorAll('.tab-btn[data-category]').forEach(btn => btn.remove());
        
        // 添加分类按钮
        this.data.categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${category === this.currentCategory ? 'active' : ''}`;
            btn.dataset.category = category;
            btn.innerHTML = `<i class="fas fa-${this.getCategoryIcon(category)}"></i> ${category}`;
            
            btn.addEventListener('click', () => this.switchCategory(category));
            
            // 添加删除功能（右键）
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (this.data.categories.length > 1) {
                    if (confirm(`确定要删除分类"${category}"吗？`)) {
                        this.removeCategory(category);
                    }
                }
            });
            
            container.insertBefore(btn, addBtn);
        });
    }

    getCategoryIcon(category) {
        const icons = {
            '学习': 'book',
            '健康': 'heart',
            '工作': 'briefcase',
            '生活': 'home',
            '娱乐': 'gamepad',
            '运动': 'dumbbell'
        };
        return icons[category] || 'tag';
    }

    renderOutlines() {
        const container = document.getElementById('outlineContainer');
        const items = this.data.outlines[this.currentCategory] || [];
        
        container.innerHTML = '';
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无大纲项目，点击"添加项目"开始规划吧！</div>';
            return;
        }
        
        this.renderOutlineItems(items, container);
    }

    renderOutlineItems(items, container, level = 1) {
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = `outline-item level-${Math.min(level, 3)}`;
            
            // 处理超链接
            const processedText = this.processLinks(item.text);
            
            div.innerHTML = `
                <div class="item-content">
                    <span class="item-text">${processedText}</span>
                    <div class="item-links">
                        ${item.links ? item.links.map(link => `
                            <a href="${link.url}" target="_blank" class="outline-link" title="${link.title || link.url}">
                                <i class="fas fa-external-link-alt"></i>
                                ${link.title || this.getLinkTypeIcon(link.url)}
                            </a>
                        `).join('') : ''}
                        <button class="action-btn link-btn" onclick="event.stopPropagation(); window.tracker.showLinkModal(${item.id})" title="管理链接">
                            <i class="fas fa-link"></i>
                        </button>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="action-btn quick-todo-btn" onclick="window.tracker.showQuickTodoModal(${item.id}, '${item.text.replace(/'/g, "\\'")}', '${this.currentCategory}')" title="快速创建待办">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    <button class="action-btn" onclick="window.tracker.showModal('添加子项目', '', (value, category, outlineItem, syncToTodo) => window.tracker.addOutlineItem(value, ${item.id}, ${item.level + 1}, syncToTodo, '${this.currentCategory}'), false, false, true)" title="添加子项">
                        <i class="fas fa-plus"></i>
                    </button>
                    ${item.children.length > 0 ? `
                        <button class="action-btn" onclick="window.tracker.toggleOutlineExpand(${item.id})" title="${item.expanded ? '折叠' : '展开'}">
                            <i class="fas fa-${item.expanded ? 'chevron-up' : 'chevron-down'}"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn" onclick="window.tracker.removeOutlineItem(${item.id})" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(div);
            
            // 渲染子项目
            if (item.children.length > 0 && item.expanded) {
                this.renderOutlineItems(item.children, container, level + 1);
            }
        });
    }
    
    // 处理文本中的链接
    processLinks(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" class="inline-link">$1</a>');
    }
    
    // 获取链接类型图标
    getLinkTypeIcon(url) {
        if (url.includes('bilibili.com') || url.includes('youtube.com')) {
            return '🎥';
        } else if (url.includes('github.com')) {
            return '💻';
        } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return '🖼️';
        } else if (url.match(/\.(pdf|doc|docx)$/i)) {
            return '📄';
        }
        return '🔗';
    }
    
    // 显示链接管理模态框
    showLinkModal(outlineId) {
        const item = this.findOutlineItem(outlineId);
        if (!item) return;
        
        const existingModal = document.querySelector('.link-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'link-modal';
        modal.innerHTML = `
            <div class="link-modal-content">
                <div class="link-modal-header">
                    <h3>管理链接 - ${item.text}</h3>
                    <button class="close-btn" onclick="this.closest('.link-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="link-modal-body">
                    <div class="existing-links">
                        <h4>现有链接：</h4>
                        <div id="linksList">
                            ${item.links ? item.links.map((link, index) => `
                                <div class="link-item">
                                    <a href="${link.url}" target="_blank" class="link-preview">
                                        ${this.getLinkTypeIcon(link.url)} ${link.title || link.url}
                                    </a>
                                    <button class="btn-remove" onclick="tracker.removeLink(${outlineId}, ${index})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('') : '<div class="empty-links">暂无链接</div>'}
                        </div>
                    </div>
                    <div class="add-link-section">
                        <h4>添加新链接：</h4>
                        <div class="form-group">
                            <label>链接地址：</label>
                            <input type="url" id="newLinkUrl" placeholder="粘贴链接地址...">
                        </div>
                        <div class="form-group">
                            <label>链接标题（可选）：</label>
                            <input type="text" id="newLinkTitle" placeholder="输入链接标题...">
                        </div>
                        <div class="form-actions">
                            <button class="btn-cancel" onclick="this.closest('.link-modal').remove()">
                                <i class="fas fa-times"></i> 关闭
                            </button>
                            <button class="btn-add" onclick="window.tracker.addLink(${outlineId})">
                                <i class="fas fa-plus"></i> 添加链接
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 聚焦URL输入框
        setTimeout(() => {
            document.getElementById('newLinkUrl').focus();
        }, 100);
    }
    
    // 添加链接
    addLink(outlineId) {
        const urlInput = document.getElementById('newLinkUrl');
        const titleInput = document.getElementById('newLinkTitle');
        const url = urlInput.value.trim();
        const title = titleInput.value.trim();
        
        if (!url) {
            alert('请输入链接地址');
            return;
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch {
            alert('请输入有效的链接地址');
            return;
        }
        
        const item = this.findOutlineItem(outlineId);
        if (!item) return;
        
        if (!item.links) {
            item.links = [];
        }
        
        item.links.push({
            url: url,
            title: title || null
        });
        
        this.saveData();
        this.renderOutlines();
        
        // 更新模态框
        this.showLinkModal(outlineId);
        
        this.showNotification('链接添加成功');
    }
    
    // 删除链接
    removeLink(outlineId, linkIndex) {
        const item = this.findOutlineItem(outlineId);
        if (!item || !item.links) return;
        
        if (confirm('确定要删除这个链接吗？')) {
            item.links.splice(linkIndex, 1);
            this.saveData();
            this.renderOutlines();
            
            // 更新模态框
            this.showLinkModal(outlineId);
            
            this.showNotification('链接删除成功');
        }
    }
    
    // 获取待办项目关联的大纲项目文本
    getTodoOutlineText(todo) {
        console.log('getTodoOutlineText - Todo:', todo.text, 'outlineRef:', todo.outlineRef, 'outlineItem:', todo.outlineItem);
        if (todo.outlineRef) {
            // 手动添加的待办使用outlineRef对象
            console.log('使用outlineRef:', todo.outlineRef.text);
            return todo.outlineRef.text;
        } else if (todo.outlineItem) {
            // 快速创建的待办使用outlineItem ID
            const outlineItem = this.findOutlineItem(todo.outlineItem);
            console.log('使用outlineItem ID:', todo.outlineItem, '找到项目:', outlineItem);
            return outlineItem ? outlineItem.text : null;
        }
        console.log('没有找到关联项目');
        return null;
    }

    // 查找大纲项目 - 修复重复定义问题
    findOutlineItem(id) {
        const findInItems = (items) => {
            for (const item of items) {
                if (item.id === id) {
                    return item;
                }
                if (item.children) {
                    const found = findInItems(item.children);
                    if (found) return found;
                }
            }
            return null;
        };
        
        // 在所有分类中查找
        for (const category of this.data.categories) {
            const items = this.data.outlines[category] || [];
            const found = findInItems(items);
            if (found) return found;
        }
        
        return null;
    }

    renderTodos() {
        const container = document.getElementById('todoContainer');
        const today = new Date().toISOString().split('T')[0];
        
        // 只显示未完成的待办
        const incompleteTodos = this.data.todos.filter(todo => !todo.completed);
        
        container.innerHTML = '';
        
        if (incompleteTodos.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无待办事项</div>';
            return;
        }
        
        // 分离正常待办和逾期待办
        const normalTodos = incompleteTodos.filter(todo => !todo.isOverdue && todo.targetDate >= today);
        const overdueTodos = incompleteTodos.filter(todo => todo.isOverdue || todo.targetDate < today);
        
        // 显示逾期待办（红色区域）
        if (overdueTodos.length > 0) {
            const overdueSection = document.createElement('div');
            overdueSection.className = 'todo-section overdue';
            overdueSection.innerHTML = '<h3><i class="fas fa-exclamation-triangle"></i> 逾期待办</h3>';
            
            const overdueByCategory = this.groupTodosByCategory(overdueTodos);
            Object.keys(overdueByCategory).forEach(category => {
                const categoryGroup = document.createElement('div');
                categoryGroup.className = 'category-group overdue';
                categoryGroup.innerHTML = `
                    <h4 class="category-group-title">
                        <i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i>
                        ${category}
                    </h4>
                `;
                
                overdueByCategory[category].forEach(todo => {
                    this.renderTodoItem(todo, categoryGroup);
                });
                
                overdueSection.appendChild(categoryGroup);
            });
            
            container.appendChild(overdueSection);
        }
        
        // 显示正常待办
        if (normalTodos.length > 0) {
            const pendingSection = document.createElement('div');
            pendingSection.className = 'todo-section';
            pendingSection.innerHTML = '<h3>今日待办</h3>';
            
            const todosByCategory = this.groupTodosByCategory(normalTodos);
            Object.keys(todosByCategory).forEach(category => {
                const categoryGroup = document.createElement('div');
                categoryGroup.className = 'category-group';
                categoryGroup.innerHTML = `
                    <h4 class="category-group-title">
                        <i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i>
                        ${category}
                    </h4>
                `;
                
                todosByCategory[category].forEach(todo => {
                    this.renderTodoItem(todo, categoryGroup);
                });
                
                pendingSection.appendChild(categoryGroup);
            });
            
            container.appendChild(pendingSection);
        }
    }

    groupTodosByCategory(todos) {
        const grouped = {};
        todos.forEach(todo => {
            if (!grouped[todo.category]) {
                grouped[todo.category] = [];
            }
            grouped[todo.category].push(todo);
        });
        return grouped;
    }

    renderTodoItem(todo, container) {
        const div = document.createElement('div');
        div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        div.innerHTML = `
            <div class="item-content">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" onclick="tracker.toggleTodoComplete(${todo.id})"></div>
                <span class="item-text">${todo.text}</span>
                ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                ${this.getTodoOutlineText(todo) ? `<span class="outline-ref-tag"><i class="fas fa-link"></i> ${this.getTodoOutlineText(todo)}</span>` : '<span class="independent-tag"><i class="fas fa-star"></i> 独立待办</span>'}
                <span class="category-tag" style="background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; color: #6c757d;">${todo.category}</span>
            </div>
            <div class="item-actions">
                ${todo.isLocked ? `
                    <button class="action-btn unlock-btn" onclick="tracker.unlockTodoItem(${todo.id})" title="解锁">
                        <i class="fas fa-unlock"></i>
                    </button>
                ` : ''}
                <button class="action-btn" onclick="tracker.removeTodoItem(${todo.id})" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        container.appendChild(div);
    }

    renderTomorrowTodos() {
        const container = document.getElementById('tomorrowContainer');
        const todos = this.data.tomorrowTodos.filter(todo => !todo.completed);
        const completedTodos = this.data.tomorrowTodos.filter(todo => todo.completed);
        
        container.innerHTML = '';
        
        if (todos.length === 0 && completedTodos.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无明日待办</div>';
            return;
        }
        
        // 按分类分组待完成的明日待办
        if (todos.length > 0) {
            const pendingSection = document.createElement('div');
            pendingSection.className = 'todo-section';
            pendingSection.innerHTML = '<h3>待完成</h3>';
            
            const todosByCategory = this.groupTodosByCategory(todos);
            Object.keys(todosByCategory).forEach(category => {
                const categoryGroup = document.createElement('div');
                categoryGroup.className = 'category-group';
                categoryGroup.innerHTML = `
                    <h4 class="category-group-title">
                        <i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i>
                        ${category}
                    </h4>
                `;
                
                todosByCategory[category].forEach(todo => {
                    this.renderTomorrowTodoItem(todo, categoryGroup);
                });
                
                pendingSection.appendChild(categoryGroup);
            });
            
            container.appendChild(pendingSection);
        }
        
        // 按分类分组已完成的明日待办
        if (completedTodos.length > 0) {
            const completedSection = document.createElement('div');
            completedSection.className = 'todo-section completed';
            completedSection.innerHTML = '<h3>已完成</h3>';
            
            const completedByCategory = this.groupTodosByCategory(completedTodos);
            Object.keys(completedByCategory).forEach(category => {
                const categoryGroup = document.createElement('div');
                categoryGroup.className = 'category-group';
                categoryGroup.innerHTML = `
                    <h4 class="category-group-title">
                        <i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i>
                        ${category}
                    </h4>
                `;
                
                completedByCategory[category].forEach(todo => {
                    this.renderTomorrowTodoItem(todo, categoryGroup);
                });
                
                completedSection.appendChild(categoryGroup);
            });
            
            container.appendChild(completedSection);
        }
    }

    renderHistory() {
        const container = document.getElementById('historyContainer');
        
        if (this.data.history.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无历史记录</div>';
            return;
        }
        
        // 根据过滤器筛选历史记录
        let filteredHistory = this.data.history;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (this.historyFilter === 'today') {
            filteredHistory = this.data.history.filter(item => {
                // 按创建日期归属
                return item.createdDate === today;
            });
        } else if (this.historyFilter === 'yesterday') {
            filteredHistory = this.data.history.filter(item => {
                // 按创建日期归属
                return item.createdDate === yesterdayStr;
            });
        }
        
        if (filteredHistory.length === 0) {
            const filterText = this.historyFilter === 'today' ? '今天' : 
                              this.historyFilter === 'yesterday' ? '昨天' : '全部';
            container.innerHTML = `<div class="empty-state">${filterText}暂无历史记录</div>`;
            return;
        }
        
        // 按创建日期分组，然后按分类层级展示
        const groupedByDate = {};
        filteredHistory.forEach(item => {
            const date = item.createdDate || new Date(item.timestamp).toISOString().split('T')[0];
            if (!groupedByDate[date]) {
                groupedByDate[date] = {};
            }
            if (!groupedByDate[date][item.category]) {
                groupedByDate[date][item.category] = [];
            }
            groupedByDate[date][item.category].push(item);
        });
        
        container.innerHTML = '';
        
        // 按日期倒序显示
        Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'history-date-group';
            
            const dateHeader = document.createElement('div');
            dateHeader.className = 'history-date-header';
            dateHeader.innerHTML = `
                <h3><i class="fas fa-calendar-day"></i> ${this.formatDateString(date)}</h3>
            `;
            dateGroup.appendChild(dateHeader);
            
            // 按分类显示
            Object.keys(groupedByDate[date]).forEach(category => {
                const categorySection = document.createElement('div');
                categorySection.className = 'history-category-section';
                
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'history-category-header';
                categoryHeader.innerHTML = `
                    <h4><i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i> ${category}</h4>
                `;
                categorySection.appendChild(categoryHeader);
                
                // 显示该分类下的项目
                groupedByDate[date][category].forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = `history-item ${item.isOverdue ? 'overdue' : ''}`;
                    
                    const overdueLabel = item.isOverdue ? '<span class="overdue-label">逾期</span>' : '';
                    const completedTime = item.completedDate !== item.createdDate ? 
                        `<span class="completed-date">完成于: ${this.formatDateString(item.completedDate)}</span>` : '';
                    
                    itemDiv.innerHTML = `
                        <div class="history-content">
                            <span class="history-text">${item.text}</span>
                            ${overdueLabel}
                            ${completedTime}
                        </div>
                        <span class="history-time">${this.formatTime(new Date(item.timestamp))}</span>
                    `;
                    categorySection.appendChild(itemDiv);
                });
                
                dateGroup.appendChild(categorySection);
            });
            
            container.appendChild(dateGroup);
        });
    }
    
    // 格式化日期字符串
    formatDateString(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (dateStr === today.toISOString().split('T')[0]) {
            return '今天';
        } else if (dateStr === yesterday.toISOString().split('T')[0]) {
            return '昨天';
        } else {
            return date.toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    updateStats() {
        document.getElementById('streakDays').textContent = this.data.stats.streakDays;
        document.getElementById('todayCompleted').textContent = this.data.stats.todayCompleted;
        document.getElementById('totalCompleted').textContent = this.data.stats.totalCompleted;
    }

    // 历史记录过滤
    setHistoryFilter(filter) {
        this.historyFilter = filter;
        
        // 更新按钮状态
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (filter === 'today') {
            document.getElementById('historyTodayBtn').classList.add('active');
        } else if (filter === 'yesterday') {
            document.getElementById('historyYesterdayBtn').classList.add('active');
        } else {
            document.getElementById('historyAllBtn').classList.add('active');
        }
        
        this.renderHistory();
    }

    // 工具方法
    formatDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return '今天';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return '昨天';
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // 快速创建待办模态框
    showQuickTodoModal(outlineId, outlineText, category) {
        const existingModal = document.querySelector('.quick-todo-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'quick-todo-modal';
        modal.innerHTML = `
            <div class="quick-todo-content">
                <div class="quick-todo-header">
                    <h3>快速创建待办</h3>
                    <button class="close-btn" onclick="this.closest('.quick-todo-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="quick-todo-body">
                    <div class="outline-reference">
                        <i class="fas fa-link"></i>
                        <span>关联项目：${outlineText}</span>
                    </div>
                    <div class="form-group">
                        <label>待办内容：</label>
                        <input type="text" id="quickTodoText" placeholder="输入待办事项..." value="">
                    </div>
                    <div class="form-group">
                        <label>添加到：</label>
                        <div class="todo-type-buttons">
                            <button class="todo-type-btn active" data-type="today">
                                <i class="fas fa-calendar-day"></i> 今日待办
                            </button>
                            <button class="todo-type-btn" data-type="tomorrow">
                                <i class="fas fa-calendar-plus"></i> 明日待办
                            </button>
                        </div>
                    </div>
                    <div class="form-group lock-option" style="display: none;">
                        <div class="lock-checkbox">
                            <input type="checkbox" id="lockTomorrowOption">
                            <label for="lockTomorrowOption">同时锁定明日待办</label>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button class="btn-cancel" onclick="this.closest('.quick-todo-modal').remove()">取消</button>
                        <button class="btn-confirm" onclick="window.tracker.createQuickTodo(${outlineId}, '${category}')">创建</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定类型切换事件
        modal.querySelectorAll('.todo-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.todo-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 显示/隐藏锁定选项
                const lockOption = modal.querySelector('.lock-option');
                if (btn.dataset.type === 'tomorrow') {
                    lockOption.style.display = 'block';
                } else {
                    lockOption.style.display = 'none';
                }
            });
        });
        
        // 聚焦输入框
        setTimeout(() => {
            document.getElementById('quickTodoText').focus();
        }, 100);
        
        // 回车键创建
        document.getElementById('quickTodoText').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createQuickTodo(outlineId, category);
            }
        });
    }
    
    // 创建快速待办
    createQuickTodo(outlineId, category) {
        const modal = document.querySelector('.quick-todo-modal');
        const todoText = document.getElementById('quickTodoText').value.trim();
        const todoType = modal.querySelector('.todo-type-btn.active').dataset.type;
        
        if (!todoText) {
            alert('请输入待办内容');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const newTodo = {
            id: Date.now(),
            text: todoText,
            completed: false,
            category: category,
            outlineItem: outlineId,
            createdDate: today,
            targetDate: todoType === 'today' ? today : tomorrowStr,
            completedDate: null,
            isOverdue: false
        };
        
        // 根据类型添加到对应列表
        if (todoType === 'today') {
            this.data.todos.push(newTodo);
        } else {
            this.data.tomorrowTodos.push(newTodo);
            
            // 检查是否需要锁定明日待办和设置待办为锁定状态
            const lockCheckbox = document.getElementById('lockTomorrowOption');
            if (lockCheckbox && lockCheckbox.checked) {
                this.data.tomorrowLocked = true;
                newTodo.isLocked = true; // 设置待办本身为锁定状态
            }
        }
        
        // 如果是明日待办且已锁定，需要检查锁定状态
        if (todoType === 'tomorrow' && this.data.tomorrowLocked) {
            // 明日待办已锁定，但仍然可以添加，只是会有提示
            console.log('明日待办已锁定，但允许从大纲快速添加');
        }
        
        this.saveData();
        this.renderTodos();
        this.renderTomorrowTodos();
        this.updateStats();
        
        modal.remove();
        
        // 显示成功提示
        this.showNotification(`已添加到${todoType === 'today' ? '今日' : '明日'}待办`);
    }
    
    // 显示通知
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // 视图切换功能
    toggleOutlineView() {
        this.currentOutlineView = this.currentOutlineView === 'list' ? 'mindmap' : 'list';
        const btn = document.getElementById('outlineViewToggle');
        const fullscreenBtn = document.getElementById('outlineFullscreenBtn');
        
        if (this.currentOutlineView === 'mindmap') {
            btn.innerHTML = '<i class="fas fa-list"></i> 列表视图';
            document.getElementById('outlineContainer').style.display = 'none';
            document.getElementById('outlineMindMap').style.display = 'block';
            this.renderOutlineMindMap();
        } else {
            btn.innerHTML = '<i class="fas fa-project-diagram"></i> 思维导图';
            document.getElementById('outlineContainer').style.display = 'block';
            document.getElementById('outlineMindMap').style.display = 'none';
        }
        // 检查按钮是否存在再操作
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
        }
    }

    toggleTodoView() {
        this.currentTodoView = this.currentTodoView === 'list' ? 'mindmap' : 'list';
        const btn = document.getElementById('todoViewToggle');
        const fullscreenBtn = document.getElementById('todoFullscreenBtn');
        
        if (this.currentTodoView === 'mindmap') {
            btn.innerHTML = '<i class="fas fa-list"></i> 列表视图';
            document.getElementById('todoContainer').style.display = 'none';
            document.getElementById('todoMindMap').style.display = 'block';
            this.renderTodoMindMap();
        } else {
            btn.innerHTML = '<i class="fas fa-project-diagram"></i> 思维导图';
            document.getElementById('todoContainer').style.display = 'block';
            document.getElementById('todoMindMap').style.display = 'none';
        }
        // 检查按钮是否存在再操作
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
        }
    }

    toggleTomorrowView() {
        this.currentTomorrowView = this.currentTomorrowView === 'list' ? 'mindmap' : 'list';
        const btn = document.getElementById('tomorrowViewToggle');
        const fullscreenBtn = document.getElementById('tomorrowFullscreenBtn');
        
        if (this.currentTomorrowView === 'mindmap') {
            btn.innerHTML = '<i class="fas fa-list"></i> 列表视图';
            document.getElementById('tomorrowContainer').style.display = 'none';
            document.getElementById('tomorrowMindMap').style.display = 'block';
            this.renderTomorrowTodoMindMap();
        } else {
            btn.innerHTML = '<i class="fas fa-project-diagram"></i> 思维导图';
            document.getElementById('tomorrowContainer').style.display = 'block';
            document.getElementById('tomorrowMindMap').style.display = 'none';
        }
        // 检查按钮是否存在再操作
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
        }
    }

    // 思维导图渲染（简化版本）
    renderOutlineMindMap() {
        const container = document.getElementById('outlineMindMap');
        const items = this.data.outlines[this.currentCategory] || [];
        
        container.innerHTML = '';
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无大纲项目</div>';
            return;
        }
        
        // 简化的思维导图显示
        const mindMapDiv = document.createElement('div');
        mindMapDiv.className = 'simple-mindmap';
        mindMapDiv.innerHTML = `
            <div class="mindmap-center">${this.currentCategory}</div>
            <div class="mindmap-branches">
                ${items.map(item => `
                    <div class="mindmap-branch">
                        <div class="branch-node">${item.text}</div>
                        ${item.children && item.children.length > 0 ? `
                            <div class="sub-branches">
                                ${item.children.map(child => `
                                    <div class="sub-branch">${child.text}</div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(mindMapDiv);
    }

    renderTodoMindMap() {
        const container = document.getElementById('todoMindMap');
        const todos = this.data.todos;
        
        container.innerHTML = '';
        
        if (todos.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无待办事项</div>';
            return;
        }
        
        // 按分类和大纲组织待办事项
        const todosByCategory = {};
        todos.forEach(todo => {
            if (!todosByCategory[todo.category]) {
                todosByCategory[todo.category] = {
                    withOutline: {},
                    withoutOutline: []
                };
            }
            
            if (todo.outlineItem) {
                // 查找关联的大纲项目
                const outlineItem = this.findOutlineItem(todo.outlineItem);
                const outlineText = outlineItem ? outlineItem.text : '未知项目';
                if (!todosByCategory[todo.category].withOutline[outlineText]) {
                    todosByCategory[todo.category].withOutline[outlineText] = [];
                }
                todosByCategory[todo.category].withOutline[outlineText].push(todo);
            } else {
                todosByCategory[todo.category].withoutOutline.push(todo);
            }
        });
        
        const mindMapDiv = document.createElement('div');
        mindMapDiv.className = 'simple-mindmap';
        mindMapDiv.innerHTML = `
            <div class="mindmap-center">待办事项</div>
            <div class="mindmap-branches">
                ${Object.keys(todosByCategory).map(category => `
                    <div class="mindmap-branch">
                        <div class="branch-node">${category}</div>
                        <div class="sub-branches">
                            ${Object.keys(todosByCategory[category].withOutline).map(outlineText => `
                                <div class="outline-group">
                                    <div class="outline-branch-title">${outlineText}</div>
                                    <div class="outline-todos">
                                        ${todosByCategory[category].withOutline[outlineText].map(todo => `
                                            <div class="sub-branch todo-with-outline ${todo.completed ? 'completed' : ''}">
                                                ${todo.text}
                                                ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                            ${todosByCategory[category].withoutOutline.length > 0 ? `
                                <div class="outline-group">
                                    <div class="outline-branch-title no-outline">独立待办</div>
                                    <div class="outline-todos">
                                        ${todosByCategory[category].withoutOutline.map(todo => `
                                            <div class="sub-branch todo-without-outline ${todo.completed ? 'completed' : ''}">
                                                ${todo.text}
                                                ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(mindMapDiv);
    }

    renderTomorrowTodoMindMap() {
        const container = document.getElementById('tomorrowMindMap');
        const todos = this.data.tomorrowTodos;
        
        container.innerHTML = '';
        
        if (todos.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无明日待办</div>';
            return;
        }
        
        // 按分类和大纲组织明日待办事项
        const todosByCategory = {};
        todos.forEach(todo => {
            if (!todosByCategory[todo.category]) {
                todosByCategory[todo.category] = {
                    withOutline: {},
                    withoutOutline: []
                };
            }
            
            if (todo.outlineItem) {
                // 查找关联的大纲项目
                const outlineItem = this.findOutlineItem(todo.outlineItem);
                const outlineText = outlineItem ? outlineItem.text : '未知项目';
                if (!todosByCategory[todo.category].withOutline[outlineText]) {
                    todosByCategory[todo.category].withOutline[outlineText] = [];
                }
                todosByCategory[todo.category].withOutline[outlineText].push(todo);
            } else {
                todosByCategory[todo.category].withoutOutline.push(todo);
            }
        });
        
        const mindMapDiv = document.createElement('div');
        mindMapDiv.className = 'simple-mindmap';
        mindMapDiv.innerHTML = `
            <div class="mindmap-center">明日待办</div>
            <div class="mindmap-branches">
                ${Object.keys(todosByCategory).map(category => `
                    <div class="mindmap-branch">
                        <div class="branch-node">${category}</div>
                        <div class="sub-branches">
                            ${Object.keys(todosByCategory[category].withOutline).map(outlineText => `
                                <div class="outline-group">
                                    <div class="outline-branch-title">${outlineText}</div>
                                    <div class="outline-todos">
                                        ${todosByCategory[category].withOutline[outlineText].map(todo => `
                                            <div class="sub-branch todo-with-outline ${todo.completed ? 'completed' : ''}">
                                                ${todo.text}
                                                ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                            ${todosByCategory[category].withoutOutline.length > 0 ? `
                                <div class="outline-group">
                                    <div class="outline-branch-title no-outline">独立待办</div>
                                    <div class="outline-todos">
                                        ${todosByCategory[category].withoutOutline.map(todo => `
                                            <div class="sub-branch todo-without-outline ${todo.completed ? 'completed' : ''}">
                                                ${todo.text}
                                                ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(mindMapDiv);
    }

    // 导出功能
    initExportMenu() {
        const today = new Date().toISOString().split('T')[0];
        const startDateInput = document.getElementById('exportStartDate');
        const endDateInput = document.getElementById('exportEndDate');
        
        if (!startDateInput.value) {
            startDateInput.value = today;
        }
        if (!endDateInput.value) {
            endDateInput.value = today;
        }
    }

    toggleExportMenu() {
        const menu = document.getElementById('exportMenu');
        const isVisible = menu.style.display === 'block';
        
        if (isVisible) {
            menu.style.display = 'none';
        } else {
            menu.style.display = 'block';
            this.bindExportEvents();
        }
    }

    bindExportEvents() {
        // 导出JSON
        const exportJSONBtn = document.getElementById('exportJSON');
        if (exportJSONBtn && !exportJSONBtn.hasAttribute('data-bound')) {
            exportJSONBtn.setAttribute('data-bound', 'true');
            exportJSONBtn.addEventListener('click', () => {
                this.exportData('json');
            });
        }

        // 导出TXT
        const exportTXTBtn = document.getElementById('exportTXT');
        if (exportTXTBtn && !exportTXTBtn.hasAttribute('data-bound')) {
            exportTXTBtn.setAttribute('data-bound', 'true');
            exportTXTBtn.addEventListener('click', () => {
                this.exportData('txt');
            });
        }

        // 时间范围预设按钮
        const presetButtons = ['exportToday', 'exportYesterday', 'exportThisWeek', 'exportAll'];
        presetButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn && !btn.hasAttribute('data-bound')) {
                btn.setAttribute('data-bound', 'true');
                btn.addEventListener('click', () => {
                    this.setExportDateRange(btnId.replace('export', '').toLowerCase());
                });
            }
        });
    }

    setExportDateRange(range) {
        this.exportDateRange = range;
        
        // 更新按钮状态
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (range === 'today') {
            document.getElementById('exportToday').classList.add('active');
            document.getElementById('exportStartDate').value = today.toISOString().split('T')[0];
            document.getElementById('exportEndDate').value = today.toISOString().split('T')[0];
        } else if (range === 'yesterday') {
            document.getElementById('exportYesterday').classList.add('active');
            document.getElementById('exportStartDate').value = yesterday.toISOString().split('T')[0];
            document.getElementById('exportEndDate').value = yesterday.toISOString().split('T')[0];
        } else if (range === 'thisweek') {
            document.getElementById('exportThisWeek').classList.add('active');
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            document.getElementById('exportStartDate').value = weekStart.toISOString().split('T')[0];
            document.getElementById('exportEndDate').value = today.toISOString().split('T')[0];
        } else if (range === 'all') {
            document.getElementById('exportAll').classList.add('active');
            document.getElementById('exportStartDate').value = '';
            document.getElementById('exportEndDate').value = '';
        }
    }

    exportData(format) {
        const data = {
            categories: this.data.categories,
            outlines: this.data.outlines,
            todos: this.data.todos,
            tomorrowTodos: this.data.tomorrowTodos,
            history: this.data.history,
            stats: this.data.stats,
            exportDate: new Date().toISOString(),
            exportDateRange: this.exportDateRange
        };

        let content, filename, mimeType;
        const dateStr = new Date().toISOString().split('T')[0];

        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            filename = `personal-growth-tracker-${dateStr}.json`;
            mimeType = 'application/json';
        } else if (format === 'txt') {
            content = this.formatDataAsText(data);
            filename = `personal-growth-tracker-${dateStr}.txt`;
            mimeType = 'text/plain';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.toggleExportMenu();
    }

    formatDataAsText(data) {
        let text = `个人成长追踪器数据\n`;
        text += `导出时间：${new Date(data.exportDate).toLocaleString('zh-CN')}\n\n`;
        
        // 统计信息
        text += `=== 统计信息 ===\n`;
        text += `连续天数：${data.stats.streakDays}\n`;
        text += `今日完成：${data.stats.todayCompleted}\n`;
        text += `总计完成：${data.stats.totalCompleted}\n\n`;
        
        // 分类信息
        text += `=== 分类信息 ===\n`;
        data.categories.forEach(category => {
            text += `- ${category}\n`;
        });
        text += '\n';
        
        // 成长大纲
        text += `=== 成长大纲 ===\n`;
        Object.keys(data.outlines).forEach(category => {
            text += `\n[${category}]\n`;
            text = this.exportOutlineItems(data.outlines[category], text, 0);
        });
        
        // 今日待办事项
        text += `\n=== 今日待办事项 ===\n`;
        data.todos.forEach(todo => {
            const status = todo.completed ? '✓' : '○';
            const date = todo.createdAt ? new Date(todo.createdAt).toLocaleDateString('zh-CN') : '未知日期';
            text += `${status} [${todo.category}] ${todo.text} (${date})\n`;
        });
        
        // 明日待办事项
        text += `\n=== 明日待办事项 ===\n`;
        data.tomorrowTodos.forEach(todo => {
            const status = todo.completed ? '✓' : '○';
            const date = todo.createdAt ? new Date(todo.createdAt).toLocaleDateString('zh-CN') : '未知日期';
            text += `${status} [${todo.category}] ${todo.text} (${date})\n`;
        });
        
        // 历史记录
        text += `\n=== 历史记录 ===\n`;
        data.history.forEach(item => {
            const date = new Date(item.timestamp).toLocaleString('zh-CN');
            text += `[${date}] ${item.text}\n`;
        });
        
        return text;
    }

    exportOutlineItems(items, text, level) {
        items.forEach(item => {
            const indent = '  '.repeat(level);
            text += `${indent}- ${item.text}\n`;
            if (item.children && item.children.length > 0) {
                text = this.exportOutlineItems(item.children, text, level + 1);
            }
        });
        return text;
    }

    // 全分类视图功能
    showAllCategoriesView(type) {
        console.log('showAllCategoriesView called with type:', type);
        
        // 移除已存在的模态框
        const existingModal = document.querySelector('.fullscreen-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'fullscreen-modal';
        modal.innerHTML = `
            <div class="fullscreen-content">
                <div class="fullscreen-header">
                    <h2>${type === 'outline' ? '大纲全分类视图' : type === 'todo' ? '今日待办全分类视图' : '明日待办全分类视图'}</h2>
                    <button class="close-btn" onclick="this.closest('.fullscreen-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="fullscreen-body" id="allCategoriesContent">
                    ${this.renderAllCategoriesContent(type)}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        console.log('Modal appended to body');
    }

    renderAllCategoriesContent(type) {
        if (!this.data.categories || this.data.categories.length === 0) {
            return '<div class="empty-state">暂无分类数据</div>';
        }
        
        let content = '';
        
        this.data.categories.forEach(category => {
            let items = [];
            let emptyMessage = '';
            
            if (type === 'outline') {
                items = this.data.outlines[category] || [];
                emptyMessage = '暂无大纲项目';
            } else if (type === 'todo') {
                items = this.data.todos.filter(todo => todo.category === category);
                emptyMessage = '暂无待办事项';
            } else if (type === 'tomorrow') {
                items = this.data.tomorrowTodos.filter(todo => todo.category === category);
                emptyMessage = '暂无明日待办';
            }
            
            content += `
                <div class="category-section">
                    <h3 class="category-title">
                        <i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i>
                        ${category}
                    </h3>
                    <div class="category-items">
                        ${items.length > 0 ? this.renderCategoryItems(items, type) : `<div class="empty-state">${emptyMessage}</div>`}
                    </div>
                </div>
            `;
        });
        
        return content;
    }

    renderCategoryItems(items, type) {
        if (type === 'outline') {
            return items.map(item => `
                <div class="outline-item-display">
                    <span class="item-text">${item.text}</span>
                    ${item.children && item.children.length > 0 ? `
                        <div class="sub-items">
                            ${item.children.map(child => `
                                <div class="sub-item">${child.text}</div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            const pendingItems = items.filter(item => !item.completed);
            const completedItems = items.filter(item => item.completed);
            
            let html = '';
            if (pendingItems.length > 0) {
                html += '<div class="pending-section"><h4>待完成</h4>';
                html += pendingItems.map(item => `
                    <div class="todo-item-display">
                        <span class="item-text">${item.text}</span>
                        ${item.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                    </div>
                `).join('');
                html += '</div>';
            }
            
            if (completedItems.length > 0) {
                html += '<div class="completed-section"><h4>已完成</h4>';
                html += completedItems.map(item => `
                    <div class="todo-item-display completed">
                        <span class="item-text">${item.text}</span>
                        ${item.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                    </div>
                `).join('');
                html += '</div>';
            }
            
            return html;
        }
    }


    renderFullscreenMindMap(type) {
        if (type === 'outline') {
            return this.renderFullscreenOutlineMindMap();
        } else if (type === 'todo') {
            return this.renderFullscreenTodoMindMap();
        } else if (type === 'tomorrow') {
            return this.renderFullscreenTomorrowMindMap();
        }
    }

    renderFullscreenOutlineMindMap() {
        const allOutlines = {};
        this.data.categories.forEach(category => {
            const items = this.data.outlines[category] || [];
            if (items.length > 0) {
                allOutlines[category] = items;
            }
        });

        if (Object.keys(allOutlines).length === 0) {
            return '<div class="empty-state">暂无大纲项目</div>';
        }

        return `
            <div class="fullscreen-mindmap">
                <div class="mindmap-center">成长大纲</div>
                <div class="mindmap-branches">
                    ${Object.keys(allOutlines).map(category => `
                        <div class="mindmap-branch">
                            <div class="branch-node category-node">
                                <i class="fas ${this.categoryIcons[category] || 'fa-folder'}"></i>
                                ${category}
                            </div>
                            <div class="sub-branches">
                                ${allOutlines[category].map(item => `
                                    <div class="sub-branch outline-branch">
                                        ${item.text}
                                        ${item.children && item.children.length > 0 ? `
                                            <div class="third-level">
                                                ${item.children.map(child => `
                                                    <div class="third-branch">${child.text}</div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderFullscreenTodoMindMap() {
        const todosByProject = {};
        const independentTodos = [];
        
        this.data.todos.forEach(todo => {
            const outlineText = this.getTodoOutlineText(todo);
            console.log('思维导图分组 - Todo:', todo.text, 'outlineText:', outlineText);
            if (outlineText) {
                // 关联到大纲项目的待办
                if (!todosByProject[outlineText]) {
                    todosByProject[outlineText] = [];
                }
                todosByProject[outlineText].push(todo);
                console.log('添加到项目组:', outlineText);
            } else {
                // 独立待办
                independentTodos.push(todo);
                console.log('添加到独立待办');
            }
        });

        if (Object.keys(todosByProject).length === 0 && independentTodos.length === 0) {
            return '<div class="empty-state">暂无待办事项</div>';
        }

        return `
            <div class="fullscreen-mindmap">
                <div class="mindmap-center">今日待办</div>
                <div class="mindmap-branches">
                    ${Object.keys(todosByProject).map(projectName => `
                        <div class="mindmap-branch">
                            <div class="branch-node category-node" style="background: #d4edda; color: #155724;">
                                <i class="fas fa-link"></i>
                                ${projectName}
                            </div>
                            <div class="sub-branches">
                                ${todosByProject[projectName].map(todo => `
                                    <div class="sub-branch todo-branch ${todo.completed ? 'completed' : ''}">
                                        ${todo.text}
                                        ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                    ${independentTodos.length > 0 ? `
                        <div class="mindmap-branch">
                            <div class="branch-node category-node" style="background: #fff3cd; color: #856404;">
                                <i class="fas fa-star"></i>
                                独立待办
                            </div>
                            <div class="sub-branches">
                                ${independentTodos.map(todo => `
                                    <div class="sub-branch todo-branch ${todo.completed ? 'completed' : ''}">
                                        ${todo.text}
                                        ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderFullscreenTomorrowMindMap() {
        const todosByProject = {};
        const independentTodos = [];
        
        this.data.tomorrowTodos.forEach(todo => {
            const outlineText = this.getTodoOutlineText(todo);
            if (outlineText) {
                // 关联到大纲项目的待办
                if (!todosByProject[outlineText]) {
                    todosByProject[outlineText] = [];
                }
                todosByProject[outlineText].push(todo);
            } else {
                // 独立待办
                independentTodos.push(todo);
            }
        });

        if (Object.keys(todosByProject).length === 0 && independentTodos.length === 0) {
            return '<div class="empty-state">暂无待办事项</div>';
        }

        return `
            <div class="fullscreen-mindmap">
                <div class="mindmap-center">明日待办</div>
                <div class="mindmap-branches">
                    ${Object.keys(todosByProject).map(projectName => `
                        <div class="mindmap-branch">
                            <div class="branch-node category-node" style="background: #d4edda; color: #155724;">
                                <i class="fas fa-link"></i>
                                ${projectName}
                            </div>
                            <div class="sub-branches">
                                ${todosByProject[projectName].map(todo => `
                                    <div class="sub-branch todo-branch ${todo.completed ? 'completed' : ''}">
                                        ${todo.text}
                                        ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                    ${independentTodos.length > 0 ? `
                        <div class="mindmap-branch">
                            <div class="branch-node category-node" style="background: #fff3cd; color: #856404;">
                                <i class="fas fa-star"></i>
                                独立待办
                            </div>
                            <div class="sub-branches">
                                ${independentTodos.map(todo => `
                                    <div class="sub-branch todo-branch ${todo.completed ? 'completed' : ''}">
                                        ${todo.text}
                                        ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    hideFullscreenMindMap() {
        const modal = document.getElementById('fullscreenModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 明日待办项渲染
    renderTomorrowTodoItem(todo, container) {
        const div = document.createElement('div');
        div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        div.innerHTML = `
            <div class="item-content">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" onclick="tracker.toggleTomorrowTodoComplete(${todo.id})"></div>
                <span class="item-text">${todo.text}</span>
                ${todo.isLocked ? '<i class="fas fa-lock locked-icon" title="重复待办"></i>' : ''}
                ${todo.outlineRef ? `<span class="outline-ref-tag" style="background: #d4edda; color: #155724; padding: 2px 6px; border-radius: 8px; font-size: 0.75rem; margin-left: 8px;"><i class="fas fa-link"></i> ${todo.outlineRef.text}</span>` : '<span class="independent-tag" style="background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 8px; font-size: 0.75rem; margin-left: 8px;"><i class="fas fa-star"></i> 独立待办</span>'}
                <span class="category-tag" style="background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; color: #6c757d;">${todo.category}</span>
            </div>
            <div class="item-actions">
                ${todo.isLocked ? `
                    <button class="action-btn unlock-btn" onclick="tracker.unlockTomorrowTodoItem(${todo.id})" title="解锁">
                        <i class="fas fa-unlock"></i>
                    </button>
                ` : ''}
                <button class="action-btn" onclick="tracker.transferSingleTodoToToday(${todo.id})" title="转换到今日">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <button class="action-btn" onclick="tracker.removeTomorrowTodoItem(${todo.id})" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        container.appendChild(div);
    }

    // 解锁待办功能
    unlockTodoItem(id) {
        const todo = this.data.todos.find(t => t.id === id);
        if (todo && todo.isLocked) {
            todo.isLocked = false;
            this.saveData();
            this.renderTodos();
        }
    }

    unlockTomorrowTodoItem(id) {
        const todo = this.data.tomorrowTodos.find(t => t.id === id);
        if (todo && todo.isLocked) {
            todo.isLocked = false;
            this.saveData();
            this.renderTomorrowTodos();
        }
    }

    // 修改转换逻辑，保持锁定的待办
    transferSingleTodoToToday(id) {
        const todoIndex = this.data.tomorrowTodos.findIndex(t => t.id === id);
        if (todoIndex !== -1) {
            const todo = this.data.tomorrowTodos[todoIndex];
            
            // 添加到今日待办
            const newTodo = {
                ...todo,
                id: Date.now() + Math.random(),
                createdAt: new Date().toISOString(),
                completed: false
            };
            this.data.todos.push(newTodo);
            
            // 如果不是锁定的待办，则从明日待办中移除
            if (!todo.isLocked) {
                this.data.tomorrowTodos.splice(todoIndex, 1);
            } else {
                // 如果是锁定的待办，重置完成状态
                todo.completed = false;
            }
            
            this.saveData();
            this.renderTodos();
            this.renderTomorrowTodos();
            this.updateStats();
        }
    }
}

// 初始化应用
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new PersonalGrowthTracker();
    // 确保全局可访问
    window.tracker = tracker;
});
