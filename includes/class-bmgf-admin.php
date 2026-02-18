<?php
/**
 * BMGF Admin Panel
 * Provides WordPress admin interface for editing dashboard data
 */

if (!defined('ABSPATH')) {
    exit;
}

class BMGF_Admin {

    private static ?BMGF_Admin $instance = null;
    private BMGF_Data_Manager $data_manager;

    public static function get_instance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->data_manager = BMGF_Data_Manager::get_instance();

        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('wp_ajax_bmgf_save_section', [$this, 'ajax_save_section']);
        add_action('wp_ajax_bmgf_reset_defaults', [$this, 'ajax_reset_defaults']);
        add_action('wp_ajax_bmgf_upload_file', [$this, 'ajax_upload_file']);
        add_action('wp_ajax_bmgf_apply_upload', [$this, 'ajax_apply_upload']);
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu(): void {
        add_menu_page(
            'BMGF Dashboard Settings',
            'BMGF Dashboard',
            'manage_options',
            'bmgf-dashboard',
            [$this, 'render_admin_page'],
            'dashicons-chart-area',
            30
        );
    }

    /**
     * Enqueue admin CSS and JS
     */
    public function enqueue_admin_assets(string $hook): void {
        if ($hook !== 'toplevel_page_bmgf-dashboard') {
            return;
        }

        wp_enqueue_style(
            'bmgf-admin-style',
            BMGF_DASHBOARD_URL . 'admin/css/bmgf-admin.css',
            [],
            BMGF_DASHBOARD_VERSION
        );

        wp_enqueue_script(
            'bmgf-admin-script',
            BMGF_DASHBOARD_URL . 'admin/js/bmgf-admin.js',
            ['jquery'],
            BMGF_DASHBOARD_VERSION,
            true
        );

        wp_enqueue_script(
            'bmgf-upload-script',
            BMGF_DASHBOARD_URL . 'admin/js/bmgf-upload.js',
            ['jquery', 'bmgf-admin-script'],
            BMGF_DASHBOARD_VERSION,
            true
        );

        wp_localize_script('bmgf-admin-script', 'bmgfAdmin', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('bmgf_admin_nonce'),
            'data' => $this->data_manager->get_all_data(),
        ]);
    }

    /**
     * Render admin page
     */
    public function render_admin_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.'));
        }

        include BMGF_DASHBOARD_PATH . 'admin/partials/admin-page.php';
    }

    /**
     * AJAX handler for saving a section
     */
    public function ajax_save_section(): void {
        check_ajax_referer('bmgf_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permission denied']);
            return;
        }

        $section = sanitize_text_field($_POST['section'] ?? '');
        $data = isset($_POST['data']) ? $this->sanitize_section_data($section, $_POST['data']) : [];

        if (empty($section)) {
            wp_send_json_error(['message' => 'Invalid section']);
            return;
        }

        $result = $this->data_manager->save_section($section, $data);

        if ($result) {
            wp_send_json_success(['message' => 'Section saved successfully']);
        } else {
            wp_send_json_error(['message' => 'Failed to save section']);
        }
    }

    /**
     * AJAX handler for resetting to defaults
     */
    public function ajax_reset_defaults(): void {
        check_ajax_referer('bmgf_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permission denied']);
            return;
        }

        $result = $this->data_manager->reset_to_defaults();
        $defaults = $this->data_manager->get_defaults();

        wp_send_json_success([
            'message' => 'Reset to defaults successfully',
            'data' => $defaults,
        ]);
    }

    /**
     * Get the temp directory for storing parsed upload data
     */
    private function get_upload_temp_dir(): string {
        $dir = BMGF_DASHBOARD_PATH . 'tmp';
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
            // Protect directory
            file_put_contents($dir . '/.htaccess', 'Deny from all');
            file_put_contents($dir . '/index.php', '<?php // Silence is golden.');
        }
        return $dir;
    }

    /**
     * Save parsed data to a temp file (avoids wp_options size limits)
     */
    private function save_parsed_temp(string $file_type, array $parsed): string {
        $dir = $this->get_upload_temp_dir();
        $filename = 'bmgf_' . $file_type . '_' . get_current_user_id() . '_' . time() . '.json';
        $filepath = $dir . '/' . $filename;
        file_put_contents($filepath, json_encode($parsed));
        return $filepath;
    }

    /**
     * Load parsed data from a temp file
     */
    private function load_parsed_temp(string $filepath): ?array {
        if (!file_exists($filepath) || !is_readable($filepath)) {
            return null;
        }
        // Check file is within our temp dir
        $real = realpath($filepath);
        $dir = realpath($this->get_upload_temp_dir());
        if ($real === false || $dir === false || strpos($real, $dir) !== 0) {
            return null;
        }
        $data = json_decode(file_get_contents($filepath), true);
        return is_array($data) ? $data : null;
    }

    /**
     * AJAX handler for file upload (institutions or courses)
     */
    public function ajax_upload_file(): void {
        check_ajax_referer('bmgf_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permission denied']);
            return;
        }

        $file_type = sanitize_text_field($_POST['file_type'] ?? '');
        if (!in_array($file_type, ['institutions', 'courses'], true)) {
            wp_send_json_error(['message' => 'Invalid file type parameter.']);
            return;
        }

        if (empty($_FILES['file'])) {
            wp_send_json_error(['message' => 'No file uploaded. Check your server upload_max_filesize (' . ini_get('upload_max_filesize') . ') and post_max_size (' . ini_get('post_max_size') . ').']);
            return;
        }

        $file = $_FILES['file'];

        // Check for PHP upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $error_messages = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds server upload_max_filesize (' . ini_get('upload_max_filesize') . '). Increase this in php.ini.',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds form MAX_FILE_SIZE.',
                UPLOAD_ERR_PARTIAL => 'File was only partially uploaded. Please try again.',
                UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
                UPLOAD_ERR_NO_TMP_DIR => 'Server missing temporary folder.',
                UPLOAD_ERR_CANT_WRITE => 'Server failed to write file to disk.',
                UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the upload.',
            ];
            $msg = $error_messages[$file['error']] ?? 'Unknown upload error (code ' . $file['error'] . ').';
            wp_send_json_error(['message' => $msg]);
            return;
        }

        // Validate extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['xlsx', 'csv'], true)) {
            wp_send_json_error(['message' => 'Invalid file type. Only .xlsx and .csv files are accepted.']);
            return;
        }

        // Validate size (50MB)
        if ($file['size'] > 50 * 1024 * 1024) {
            wp_send_json_error(['message' => 'File is too large. Maximum size is 50MB.']);
            return;
        }

        // Parse the file
        try {
            $preferred_sheet = $file_type === 'institutions' ? 'All_Institutions' : 'All_Courses';
            $parsed = BMGF_XLSX_Parser::parse($file['tmp_name'], $ext, $preferred_sheet);
        } catch (Exception $e) {
            wp_send_json_error(['message' => 'Parse error: ' . $e->getMessage()]);
            return;
        }

        if (empty($parsed['rows'])) {
            wp_send_json_error(['message' => 'File was parsed but contains no data rows.']);
            return;
        }

        // Validate required columns
        $required = $file_type === 'institutions'
            ? BMGF_Data_Mapper::INSTITUTION_REQUIRED
            : BMGF_Data_Mapper::COURSE_REQUIRED;

        $missing = BMGF_XLSX_Parser::validate_columns($parsed['headers'], $required);
        if (!empty($missing)) {
            wp_send_json_error([
                'message' => 'Missing required columns: ' . implode(', ', $missing) . '. Found columns: ' . implode(', ', $parsed['headers']),
            ]);
            return;
        }

        // Store parsed data to temp file (not transients - too large for wp_options)
        try {
            $temp_path = $this->save_parsed_temp($file_type, $parsed);
        } catch (Exception $e) {
            wp_send_json_error(['message' => 'Failed to store parsed data: ' . $e->getMessage()]);
            return;
        }

        wp_send_json_success([
            'message' => ucfirst($file_type) . ' file parsed successfully (' . count($parsed['rows']) . ' rows).',
            'transient_key' => $temp_path,
            'row_count' => count($parsed['rows']),
            'columns' => $parsed['headers'],
        ]);
    }

    /**
     * AJAX handler for applying uploaded data (or preview)
     */
    public function ajax_apply_upload(): void {
        check_ajax_referer('bmgf_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permission denied']);
            return;
        }

        @ini_set('memory_limit', '256M');
        @set_time_limit(300);

        $inst_key = sanitize_text_field($_POST['institutions_key'] ?? '');
        $courses_key = sanitize_text_field($_POST['courses_key'] ?? '');
        $preview_only = intval($_POST['preview_only'] ?? 0);

        $institutions = null;
        $courses = null;

        if ($inst_key !== '') {
            $institutions = $this->load_parsed_temp($inst_key);
            if ($institutions === null) {
                wp_send_json_error(['message' => 'Institutions data expired or not found. Please re-upload the file.']);
                return;
            }
        }

        if ($courses_key !== '') {
            $courses = $this->load_parsed_temp($courses_key);
            if ($courses === null) {
                wp_send_json_error(['message' => 'Courses data expired or not found. Please re-upload the file.']);
                return;
            }
        }

        if ($institutions === null && $courses === null) {
            wp_send_json_error(['message' => 'No uploaded data found. Please upload at least one file.']);
            return;
        }

        // Compute all sections from uploaded files
        try {
            $computed = BMGF_Data_Mapper::compute_all($institutions, $courses);
        } catch (Exception $e) {
            wp_send_json_error(['message' => 'Data computation error: ' . $e->getMessage()]);
            return;
        }

        $has_institutions_upload = ($institutions !== null);
        $has_courses_upload = ($courses !== null);
        $has_full_upload = ($has_institutions_upload && $has_courses_upload);

        $current_data = $this->data_manager->get_all_data();
        $sections_to_save = [];

        if ($has_full_upload) {
            // Full refresh: keep existing behavior
            $sections_to_save = $computed;
        } else {
            // Partial refresh: update only sections that can be safely computed
            if ($has_institutions_upload) {
                foreach (['sector_data', 'top_institutions', 'institution_size_data'] as $section) {
                    $sections_to_save[$section] = $computed[$section] ?? [];
                }
                // State-level data is driven primarily by institution enrollment totals.
                if (isset($computed['state_data']) && is_array($computed['state_data'])) {
                    $sections_to_save['state_data'] = $computed['state_data'];
                }
            }

            if ($has_courses_upload) {
                foreach (['regional_data', 'publishers', 'top_textbooks', 'period_data'] as $section) {
                    $sections_to_save[$section] = $computed[$section] ?? [];
                }
            }

            // Merge KPI fields so non-uploaded dimensions remain intact.
            $kpis = $current_data['kpis'] ?? [];
            if ($has_institutions_upload) {
                foreach ([
                    'total_institutions',
                    'total_enrollment',
                    'calc1_enrollment',
                    'calc1_share',
                    'calc2_enrollment',
                    'calc2_share',
                    'total_fte_enrollment',
                ] as $field) {
                    if (isset($computed['kpis'][$field])) {
                        $kpis[$field] = $computed['kpis'][$field];
                    }
                }
            }
            if ($has_courses_upload) {
                foreach ([
                    'avg_price_calc1',
                    'avg_price_calc2',
                    'commercial_share',
                    'oer_share',
                ] as $field) {
                    if (isset($computed['kpis'][$field])) {
                        $kpis[$field] = $computed['kpis'][$field];
                    }
                }
            }
            $sections_to_save['kpis'] = $kpis;

            // Merge filter subsets based on uploaded source(s).
            $filters = $current_data['filters'] ?? [];
            $filter_keys = ['states', 'regions', 'sectors'];
            if ($has_courses_upload) {
                $filter_keys = array_merge($filter_keys, ['publishers', 'courses', 'price_ranges']);
            }
            foreach (array_unique($filter_keys) as $key) {
                if (!empty($computed['filters'][$key]) && is_array($computed['filters'][$key])) {
                    $filters[$key] = $computed['filters'][$key];
                }
            }
            $sections_to_save['filters'] = $filters;
        }

        if ($preview_only) {
            $preview_source = $has_full_upload
                ? $computed
                : array_merge($current_data, $sections_to_save);
            $preview = BMGF_Data_Mapper::preview($preview_source);
            wp_send_json_success([
                'preview' => $preview,
                'mode' => $has_full_upload ? 'full' : 'partial',
            ]);
            return;
        }

        foreach ($sections_to_save as $section => $data) {
            $this->data_manager->save_section($section, $data);
        }

        // Clean up temp files
        if ($inst_key !== '' && file_exists($inst_key)) {
            @unlink($inst_key);
        }
        if ($courses_key !== '' && file_exists($courses_key)) {
            @unlink($courses_key);
        }

        wp_send_json_success([
            'message' => $has_full_upload
                ? 'All dashboard data updated successfully.'
                : 'Uploaded data applied successfully. Non-uploaded sections were kept unchanged.',
            'computed' => $sections_to_save,
            'updated_sections' => array_keys($sections_to_save),
            'mode' => $has_full_upload ? 'full' : 'partial',
        ]);
    }

    /**
     * Sanitize section data based on section type
     */
    private function sanitize_section_data(string $section, mixed $data): array {
        if (!is_array($data)) {
            return [];
        }

        switch ($section) {
            case 'kpis':
                return $this->sanitize_kpis($data);

            case 'regional_data':
                return $this->sanitize_regional_data($data);

            case 'sector_data':
                return $this->sanitize_sector_data($data);

            case 'publishers':
                return $this->sanitize_publishers($data);

            case 'top_institutions':
                return $this->sanitize_top_items($data, ['name', 'enrollment']);

            case 'top_textbooks':
                return $this->sanitize_top_items($data, ['name', 'publisher', 'enrollment']);

            case 'period_data':
                return $this->sanitize_period_data($data);

            case 'institution_size_data':
                return $this->sanitize_size_data($data);

            case 'filters':
                return $this->sanitize_filters($data);

            default:
                return [];
        }
    }

    private function sanitize_kpis(array $data): array {
        $sanitized = [];
        $numeric_fields = [
            'total_institutions', 'total_enrollment', 'calc1_enrollment',
            'calc1_share', 'calc2_enrollment', 'calc2_share',
            'total_fte_enrollment',
            'avg_price_calc1', 'avg_price_calc2', 'commercial_share',
            'oer_share', 'digital_share', 'print_share',
        ];

        foreach ($numeric_fields as $field) {
            if (isset($data[$field])) {
                $sanitized[$field] = floatval($data[$field]);
            }
        }

        return $sanitized;
    }

    private function sanitize_regional_data(array $data): array {
        $sanitized = [];

        foreach (['calc1', 'calc2'] as $calc) {
            if (isset($data[$calc]) && is_array($data[$calc])) {
                $sanitized[$calc] = [];
                foreach ($data[$calc] as $item) {
                    $sanitized[$calc][] = [
                        'name' => sanitize_text_field($item['name'] ?? ''),
                        'percentage' => intval($item['percentage'] ?? 0),
                        'value' => intval($item['value'] ?? 0),
                    ];
                }
            }
        }

        return $sanitized;
    }

    private function sanitize_sector_data(array $data): array {
        $sanitized = [];

        foreach (['calc1', 'calc2'] as $calc) {
            if (isset($data[$calc]) && is_array($data[$calc])) {
                $sanitized[$calc] = [];
                foreach ($data[$calc] as $item) {
                    $sanitized[$calc][] = [
                        'name' => sanitize_text_field($item['name'] ?? ''),
                        'percentage' => intval($item['percentage'] ?? 0),
                        'value' => intval($item['value'] ?? 0),
                    ];
                }
            }
        }

        return $sanitized;
    }

    private function sanitize_publishers(array $data): array {
        $sanitized = [];

        foreach ($data as $item) {
            $sanitized[] = [
                'name' => sanitize_text_field($item['name'] ?? ''),
                'market_share' => intval($item['market_share'] ?? 0),
                'enrollment' => intval($item['enrollment'] ?? 0),
                'avg_price' => floatval($item['avg_price'] ?? 0),
                'color' => sanitize_hex_color($item['color'] ?? '#000000') ?: '#000000',
            ];
        }

        return $sanitized;
    }

    private function sanitize_top_items(array $data, array $fields): array {
        $sanitized = [];

        foreach ($data as $item) {
            $sanitized_item = [];
            foreach ($fields as $field) {
                if ($field === 'enrollment') {
                    $sanitized_item[$field] = intval($item[$field] ?? 0);
                } else {
                    $sanitized_item[$field] = sanitize_text_field($item[$field] ?? '');
                }
            }
            $sanitized[] = $sanitized_item;
        }

        return $sanitized;
    }

    private function sanitize_period_data(array $data): array {
        $sanitized = [];

        foreach ($data as $item) {
            $sanitized[] = [
                'period' => sanitize_text_field($item['period'] ?? ''),
                'calc1' => intval($item['calc1'] ?? 0),
                'calc2' => intval($item['calc2'] ?? 0),
            ];
        }

        return $sanitized;
    }

    private function sanitize_size_data(array $data): array {
        $sanitized = [];

        foreach ($data as $item) {
            $sanitized[] = [
                'size' => sanitize_text_field($item['size'] ?? ''),
                'calc1' => intval($item['calc1'] ?? 0),
                'calc2' => intval($item['calc2'] ?? 0),
            ];
        }

        return $sanitized;
    }

    private function sanitize_filters(array $data): array {
        $sanitized = [];

        foreach ($data as $key => $values) {
            if (is_array($values)) {
                $sanitized[sanitize_key($key)] = array_map('sanitize_text_field', $values);
            }
        }

        return $sanitized;
    }
}
