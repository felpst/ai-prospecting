import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false
}) => {
  if (totalPages <= 1) {
    return null; // Don't render pagination if there's only one page
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const maxVisiblePages = 5;
    let pages: (number | string)[] = [];

    if (totalPages <= maxVisiblePages) {
      // Show all pages if there are only a few
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const leftBound = Math.max(2, currentPage - 1);
      const rightBound = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis if needed
      if (leftBound > 2) {
        pages.push('...');
      }

      // Add pages around current page
      for (let i = leftBound; i <= rightBound; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (rightBound < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, page: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPageChange(page);
    }
  };

  return (
    <nav className="pagination" aria-label="Pagination">
      {/* Previous page button */}
      <button
        className="pagination-button prev"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
        aria-label="Go to previous page"
      >
        ← Previous
      </button>

      {/* Page numbers */}
      <div className="pagination-pages">
        {getPageNumbers().map((page, index) => {
          if (typeof page === 'string') {
            // Ellipsis
            return (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                {page}
              </span>
            );
          }

          return (
            <button
              key={page}
              className={`pagination-number ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
              onKeyDown={(e) => handleKeyDown(e, page)}
              disabled={disabled}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next page button */}
      <button
        className="pagination-button next"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
        aria-label="Go to next page"
      >
        Next →
      </button>
    </nav>
  );
};

export default Pagination; 