import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export function Pagination({
  currentPage,
  totalPages,
  callback,
}: {
  currentPage: number
  totalPages: number
  callback: (page: number) => void
}) {
  if (totalPages <= 1) {
    return (
      <PaginationComponent>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              isActive
              onClick={() => {
                callback(1)
              }}
            >
              1
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </PaginationComponent>
    )
  }

  const siblingCount = 1
  const boundaryCount = 1

  const createRange = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i)

  const startPages = createRange(1, Math.min(boundaryCount, totalPages))
  const endPages =
    totalPages > boundaryCount
      ? createRange(
          Math.max(totalPages - boundaryCount + 1, boundaryCount + 1),
          totalPages,
        )
      : []

  const siblingsStart = Math.max(
    Math.min(
      currentPage - siblingCount,
      totalPages - boundaryCount - siblingCount * 2 - 1,
    ),
    boundaryCount + 2,
  )

  const siblingsEnd = Math.min(
    Math.max(currentPage + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : totalPages - 1,
  )

  const showStartEllipsis = siblingsStart > boundaryCount + 2
  const showEndEllipsis = siblingsEnd < totalPages - boundaryCount - 1

  return (
    <PaginationComponent>
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationPrevious
              onClick={() => {
                callback(currentPage - 1)
              }}
            />
          </PaginationItem>
        )}
        {startPages.map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              isActive={page === currentPage}
              onClick={() => {
                callback(page)
              }}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        {showStartEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {!showStartEllipsis &&
          boundaryCount + 1 < siblingsStart &&
          createRange(boundaryCount + 1, siblingsStart - 1).map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                isActive={page === currentPage}
                onClick={() => {
                  callback(page)
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
        {createRange(siblingsStart, siblingsEnd).map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              isActive={page === currentPage}
              onClick={() => {
                callback(page)
              }}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        {showEndEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {!showEndEllipsis &&
          siblingsEnd + 1 < totalPages - boundaryCount + 1 &&
          createRange(siblingsEnd + 1, totalPages - boundaryCount).map(
            (page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === currentPage}
                  onClick={() => {
                    callback(page)
                  }}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
        {endPages.map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              isActive={page === currentPage}
              onClick={() => {
                callback(page)
              }}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationNext
              onClick={() => {
                callback(currentPage + 1)
              }}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </PaginationComponent>
  )
}
