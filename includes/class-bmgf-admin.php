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
